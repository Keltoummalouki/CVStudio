import { beforeAll, describe, expect, it } from "vitest";
import { anonClient, config, createUser, type TestUser } from "./helpers";

const BUCKET = "cvstudio-assets";
// 1×1 transparent PNG.
const PNG = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  ),
  (char) => char.charCodeAt(0),
);

describe("private storage", () => {
  let ownerA: TestUser;
  let ownerB: TestUser;
  let intruder: TestUser;
  let pathA: string;

  beforeAll(async () => {
    [ownerA, ownerB, intruder] = await Promise.all([
      createUser({ allowlisted: true }),
      createUser({ allowlisted: true }),
      createUser({ allowlisted: false }),
    ]);
    pathA = `${ownerA.id}/portraits/test.png`;
  });

  it("lets an owner upload into their own folder", async () => {
    const { error } = await ownerA.client.storage
      .from(BUCKET)
      .upload(pathA, PNG, { contentType: "image/png" });
    expect(error).toBeNull();
  });

  it("refuses uploads into another owner's folder", async () => {
    const { error } = await ownerA.client.storage
      .from(BUCKET)
      .upload(`${ownerB.id}/portraits/planted.png`, PNG, { contentType: "image/png" });
    expect(error).not.toBeNull();
  });

  it("refuses uploads from a signed-in user who is not allowlisted", async () => {
    const { error } = await intruder.client.storage
      .from(BUCKET)
      .upload(`${intruder.id}/portraits/x.png`, PNG, { contentType: "image/png" });
    expect(error).not.toBeNull();
  });

  it("refuses file types other than images", async () => {
    const { error } = await ownerA.client.storage
      .from(BUCKET)
      .upload(`${ownerA.id}/portraits/notes.txt`, new TextEncoder().encode("hello"), {
        contentType: "text/plain",
      });
    expect(error).not.toBeNull();
  });

  it("keeps files invisible to other owners and anonymous visitors", async () => {
    const asOther = await ownerB.client.storage.from(BUCKET).download(pathA);
    expect(asOther.data).toBeNull();

    const asAnon = await anonClient().storage.from(BUCKET).download(pathA);
    expect(asAnon.data).toBeNull();

    // The bucket is private: the public URL pattern serves nothing.
    const publicUrl = `${config().url}/storage/v1/object/public/${BUCKET}/${pathA}`;
    const response = await fetch(publicUrl);
    expect(response.ok).toBe(false);
  });

  it("lets the owner read their file through a short-lived signed URL", async () => {
    const { data, error } = await ownerA.client.storage.from(BUCKET).createSignedUrl(pathA, 60);
    expect(error).toBeNull();
    const response = await fetch(data!.signedUrl);
    expect(response.ok).toBe(true);
    expect(response.headers.get("content-type")).toContain("image/png");
  });
});

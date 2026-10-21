import type { Metadata } from "next";
import { CvBuilder } from "@/features/cv-builder/components/cv-builder";
import { loadMasterData } from "@/features/cv-builder/server/load-master-data";
import { getCvLabels } from "@/features/cv-documents/server/labels";
import { getCvDocument, getPortraitUrl } from "@/features/cv-documents/server/queries";
import { requireOwner } from "@/lib/auth/session";
import { requireUuid } from "@/lib/data/params";

type Props = { params: Promise<{ cvId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { cvId } = await params;
  const document = await getCvDocument(requireUuid(cvId));
  return { title: document.name };
}

export default async function Page({ params }: Props) {
  const { cvId } = await params;
  const id = requireUuid(cvId);
  const context = await requireOwner();
  const [document, master, labels, photoUrl] = await Promise.all([
    getCvDocument(id),
    loadMasterData(context),
    getCvLabels(),
    getPortraitUrl(),
  ]);

  // A new revision (e.g. "load latest" after a conflict) remounts the editor with fresh state.
  return (
    <CvBuilder
      key={`${document.id}:${document.revision}`}
      document={document}
      master={master}
      labels={labels}
      photoUrl={photoUrl}
    />
  );
}

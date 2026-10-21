import { notFound } from "next/navigation";

// Any unmatched path below a valid locale renders the localized not-found page.
export default function CatchAllPage() {
  notFound();
}

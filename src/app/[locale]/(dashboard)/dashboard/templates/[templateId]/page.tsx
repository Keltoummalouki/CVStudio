import type { Metadata } from "next";
import { loadMasterData } from "@/features/cv-builder/server/load-master-data";
import { getCvLabels } from "@/features/cv-documents/server/labels";
import { getPortraitUrl } from "@/features/cv-documents/server/queries";
import { TemplateBuilder } from "@/features/cv-templates/components/template-builder";
import { getTemplate } from "@/features/cv-templates/server/queries";
import { requireOwner } from "@/lib/auth/session";
import { requireUuid } from "@/lib/data/params";

type Props = { params: Promise<{ templateId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { templateId } = await params;
  const template = await getTemplate(requireUuid(templateId));
  return { title: template.name };
}

export default async function Page({ params }: Props) {
  const { templateId } = await params;
  const id = requireUuid(templateId);
  const context = await requireOwner();
  const [template, master, labels, photoUrl] = await Promise.all([
    getTemplate(id),
    loadMasterData(context),
    getCvLabels(),
    getPortraitUrl(),
  ]);

  // A new revision (e.g. "load latest" after a conflict) remounts the editor with fresh state.
  return (
    <TemplateBuilder
      key={`${template.id}:${template.revision}`}
      template={template}
      master={master}
      labels={labels}
      photoUrl={photoUrl}
    />
  );
}

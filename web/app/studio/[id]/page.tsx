import { WriterEditor } from "@/features/writer/writer-studio";

export const metadata = { title: "จัดการนิยาย", robots: { index: false, follow: false } };
export default async function StudioEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <WriterEditor id={id} />;
}

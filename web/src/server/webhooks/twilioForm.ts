import { NextRequest } from "next/server";

export async function readTwilioForm(request: NextRequest): Promise<Record<string, string>> {
  const form = await request.formData();
  return Object.fromEntries(
    Array.from(form.entries()).map(([key, value]) => [key, String(value)])
  );
}

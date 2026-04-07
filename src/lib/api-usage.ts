import { prisma } from "@/lib/prisma";

export async function trackApiUsage(
  service: "apollo" | "snov" | "gemini" | "cerebras" | "deepseek" | "brevo" | "google" | "serper" | "zai",
  action: string,
  success: boolean = true
) {
  try {
    await prisma.apiUsage.create({
      data: { service, action, success },
    });
  } catch {
    // Don't let tracking failures break the app
  }
}

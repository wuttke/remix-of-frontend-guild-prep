import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a branch name into a human-readable title.
 * Example: "feature/xyz-abc" -> "Feature: Xyz Abc"
 */
export function formatBranchTitle(branchName: string | null | undefined): string | null {
  if (!branchName) return null;

  // Split on /
  const parts = branchName.split("/");
  if (parts.length < 2) return null;

  // First part is the type (feature, bugfix, etc.)
  const type = parts[0];
  // Remaining parts joined form the descriptive part
  const description = parts.slice(1).join(" ");

  // Capitalize first letter of type
  const capitalizedType = type.charAt(0).toUpperCase() + type.slice(1);

  // Convert description: split on - or _, capitalize each word
  const formattedDescription = description
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  return `${capitalizedType}: ${formattedDescription}`;
}

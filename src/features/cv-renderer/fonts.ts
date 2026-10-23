import { Inter, Lora, Poppins } from "next/font/google";

/**
 * The reference CVs use Poppins Regular and Bold only. Self-hosted by
 * next/font, so preview, print and the PDF engine load the same files.
 */
export const poppins = Poppins({
  weight: ["400", "700"],
  subsets: ["latin", "latin-ext"],
  display: "block",
  fallback: ["Arial", "sans-serif"],
});

/** Further choices for free-form designs (canvas-v1), self-hosted the same way. */
export const inter = Inter({
  weight: ["400", "700"],
  subsets: ["latin", "latin-ext"],
  display: "block",
  fallback: ["Arial", "sans-serif"],
});

export const lora = Lora({
  weight: ["400", "700"],
  subsets: ["latin", "latin-ext"],
  display: "block",
  fallback: ["Georgia", "serif"],
});

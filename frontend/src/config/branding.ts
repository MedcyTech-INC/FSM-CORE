/**
 * Dynamic White-Label Branding Configuration
 * Allows zero-code customization of company name, logo initials, and portal labels.
 * Configured per client via environment variables or direct config override.
 */

export interface BrandingConfig {
  companyName: string;
  portalSubtitle: string;
  logoInitials: string;
  footerText: string;
}

export const branding: BrandingConfig = {
  companyName: import.meta.env.VITE_COMPANY_NAME || "Medcy FSM",
  portalSubtitle: import.meta.env.VITE_PORTAL_SUBTITLE || "Field Sales Management",
  logoInitials: import.meta.env.VITE_COMPANY_SHORT_CODE || "M",
  footerText: import.meta.env.VITE_FOOTER_TEXT || "Medcy Field Sales & Lead Management Platform",
};

import { describe, expect, it } from "vitest";
import {
  DEFAULT_EMAIL,
  DEFAULT_PHONE,
  DEFAULT_WHATSAPP_URL,
  getContactConfig,
  getTelHref,
  getWhatsAppHref,
} from "./contact-config";

describe("contact config defaults", () => {
  it("exposes the founder phone, WhatsApp and email", () => {
    const c = getContactConfig();
    expect(c.phone).toBe(DEFAULT_PHONE);
    expect(c.email).toBe(DEFAULT_EMAIL);
    expect(c.whatsappUrl).toBe(DEFAULT_WHATSAPP_URL);
    expect(getTelHref()).toBe("tel:+917025063047");
    expect(getWhatsAppHref()).toBe("https://wa.me/917025063047");
  });

  it("prefills WhatsApp messages", () => {
    const href = getWhatsAppHref("Hi Aryanand");
    expect(href).toBe(
      "https://wa.me/917025063047?text=" + encodeURIComponent("Hi Aryanand"),
    );
  });
});

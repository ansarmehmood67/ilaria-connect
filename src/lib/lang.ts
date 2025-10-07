/**
 * Minimal i18n for Italian/English support
 */

export type Locale = "it" | "en";

export function detectLocale(): Locale {
  const envLocale = import.meta.env.VITE_DEFAULT_LOCALE;
  if (envLocale === "it" || envLocale === "en") return envLocale;
  
  // Auto-detect from browser
  const browserLang = navigator.language.toLowerCase();
  if (browserLang.startsWith("it")) return "it";
  return "en";
}

export const translations = {
  it: {
    // Header
    agentName: "Ilaria",
    agentRole: "Assistente Compliance",
    online: "Online",
    slaInfo: "Rispondo in pochi secondi",
    escalate: "Parla con un umano",
    
    // Messages
    greeting: "Ciao! Sono Ilaria, la tua assistente per la compliance aziendale. Come posso aiutarti oggi?",
    quickReplies: [
      "Devo aprire una nuova attività",
      "Verifica obblighi",
      "Parla in English"
    ],
    
    // Composer
    placeholder: "Scrivi un messaggio...",
    sending: "Invio...",
    
    // Escalation
    escalateTitle: "Vuoi parlare con un collega?",
    escalateMessage: "Ti metto in contatto con un esperto umano. Va bene?",
    escalateConfirm: "Sì, grazie",
    escalateCancel: "No, continua tu",
    escalated: "Perfetto! Ti metto in contatto con un collega umano. Resta in linea.",
    
    // Errors
    errorTitle: "Ops, c'è un problema",
    errorNetwork: "Non riesco a contattare il server. Verifica la connessione.",
    errorTimeout: "Il server ci sta mettendo troppo. Riprova tra poco.",
    errorQuota: "Hai raggiunto il limite di richieste. Riprova più tardi.",
    errorBilling: "Il servizio non è attivo. Contatta l'amministratore.",
    errorUnknown: "Qualcosa è andato storto. Riprova.",
    retry: "Riprova",
    
    // Health check
    healthCheck: "Verifica server",
    healthOk: "Server OK",
    healthFail: "Server non raggiungibile",
  },
  
  en: {
    // Header
    agentName: "Ilaria",
    agentRole: "Compliance Assistant",
    online: "Online",
    slaInfo: "I respond in seconds",
    escalate: "Talk to a human",
    
    // Messages
    greeting: "Hi! I'm Ilaria, your business compliance assistant. How can I help you today?",
    quickReplies: [
      "Start a new business",
      "Check obligations",
      "Parla in Italiano"
    ],
    
    // Composer
    placeholder: "Type a message...",
    sending: "Sending...",
    
    // Escalation
    escalateTitle: "Want to talk to a colleague?",
    escalateMessage: "I'll connect you with a human expert. Sound good?",
    escalateConfirm: "Yes, please",
    escalateCancel: "No, continue",
    escalated: "Perfect! I'm connecting you with a human colleague. Stand by.",
    
    // Errors
    errorTitle: "Oops, there's a problem",
    errorNetwork: "Can't reach the server. Check your connection.",
    errorTimeout: "The server is taking too long. Try again in a moment.",
    errorQuota: "You've reached the request limit. Try again later.",
    errorBilling: "The service is not active. Contact the administrator.",
    errorUnknown: "Something went wrong. Please try again.",
    retry: "Retry",
    
    // Health check
    healthCheck: "Check server",
    healthOk: "Server OK",
    healthFail: "Server unreachable",
  },
};

export function t(locale: Locale, key: string): string {
  const keys = key.split(".");
  let value: any = translations[locale];
  
  for (const k of keys) {
    value = value?.[k];
  }
  
  return value || key;
}

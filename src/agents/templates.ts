/**
 * Static M Language Templates
 * These are embedded directly for client-side access without needing file system access
 */

// Import the raw content of M Language files
// In a production app, these could be fetched from an API or loaded at build time

export const MLANG_TEMPLATES: Record<string, string> = {
  'TripGuardianV3.mlang': `agent TripGuardianV3 {
  meta {
    name: "TripGuardianV3"
    capabilities: ["trip-guardian", "weather", "safety"]
    version: "3.0"
    description: "Travel companion focused on safe, verifiable guidance"
    system_prompt: """You are the "Trip Guardian & Tour Planner". Your goal is to be a helpful, fun, and protective travel companion.

CORE PHILOSOPHY (The "Safe-Guide" Approach):
1. **BE A GUIDE**: Suggest itineraries, food, and venues when asked.
2. **BE A GUARDIAN**: Every recommendation MUST include a contextual safety tip.

SAFETY RAILS:
1. OFF-LIMITS: Medical/Legal advice, Violence/Hate speech.
2. PERSONA: Enthusiastic but **CONCISE**. Save tokens.

INSTRUCTIONS:
1. Analyze conversation using Time/Location context.
2. EXTRACT new details into 'updates' object.
3. "Budget" is OPTIONAL. If user says "none" or "no", set it to "Standard".
4. If Destination and Duration/Date are known -> ACTION: RUN_AGENT.
5. DO NOT ask for confirmation.
6. If user asks for recommendations (and details missing) -> ACTION: ASK_QUESTION

RESPONSE MUST BE VALID JSON ONLY."""
    welcome_message: "Hi! Share your trip details and I'll help with safety, logistics, and culture."
    extract_variables: ["Destination", "StartDate", "Duration", "Budget"]
    guardrails: {
      max_tokens_per_request: 4000
      max_requests_per_hour: 100
      safety_rules: [
        "NEVER provide medical or legal advice",
        "NEVER prescribe medications or treatments",
        "NEVER make financial investment recommendations"
      ]
      redirect_guidance: """
        When asked for medical, legal, or investment advice:
        - Acknowledge the concern empathetically
        - Explain you cannot provide that advice
        - Recommend consulting a qualified professional
      """
      required_disclaimers: [
        "I am an AI travel assistant and cannot provide medical, legal, or investment advice."
      ]
      prohibited_topics: ["medical diagnosis", "legal interpretation", "investment advice"]
    }
  }

  schedule {
    interval: "30m"
    mode: "proactive"
  }

  nodes {
    http_request getDate {
      url: "https://timeapi.io/api/Time/current/zone?timeZone=Asia/Colombo"
      method: "GET"
      timeout: 30
      optional: "true"
    }

    llm extractDetails {
      model: "gemini-2.0-flash"
      prompt: """CURRENT DATE/TIME: \${getDate_output}

Extract trip details from: '\${input}'.

Output format:
- Destination: [city name or 'MISSING']
- Duration: [nights/days or 'MISSING']
- Start Date: [specific date or 'MISSING']
- End Date: [specific date or 'MISSING']
- Specific venues/events: [list or 'MISSING']
- Budget: [amount or 'MISSING']
- Interests: [list or 'MISSING']

CRITICAL RULE: If the user did NOT provide a specific piece of information, write 'MISSING' for that field."""
    }

    llm extractCity {
      model: "gemini-2.0-flash"
      prompt: """Extract just the main destination city name from: '\${input}'.
Return ONLY the city name (e.g., 'Delhi'). If no city is mentioned, return 'MISSING'."""
    }

    http_request checkWeather {
      url: "https://wttr.in/\${extractCity_output}?format=3"
      method: "GET"
      timeout: 30
      optional: "true"
    }

    llm knowledgeCheck {
      model: "gemini-2.0-flash"
      prompt: """You are a Logistical Validator for \${extractCity_output}.
User trip details: \${extractDetails_output}

Provide timing warnings and logistics advice based on the information available.
CRITICAL RULE: DO NOT invent specific opening hours, closure days, or travel times."""
    }

    http_request fetchReviews {
      url: "https://places.googleapis.com/v1/places:searchText"
      method: "POST"
      headers: {
        "Content-Type": "application/json"
        "X-Goog-Api-Key": "\${env.GOOGLE_MAPS_KEY}"
        "X-Goog-FieldMask": "places.displayName,places.rating,places.reviews"
      }
      body: "{\\"textQuery\\": \\"Attractions in \${extractCity_output}\\"}"
      timeout: 30
      optional: "true"
    }

    llm reviewSummarizer {
      model: "gemini-2.0-flash"
      prompt: """Review Data Analysis for \${extractCity_output}.

Review data: \${fetchReviews_output}
User trip: \${input}

Extract Insider Tips, Hidden Warnings, and Real Vibe from reviews."""
    }

    llm newsAlert {
      model: "gemini-2.0-flash"
      prompt: """Safety Briefing for \${extractCity_output}.
User trip: \${input}

Provide common, well-known safety risks, emergency numbers, and transport safety tips.
CRITICAL RULE: DO NOT invent breaking news."""
    }

    llm geniusLoci {
      model: "gemini-2.0-flash"
      prompt: """Cultural Wisdom for \${extractCity_output}.
User trip: \${input}

Provide timeless, well-established cultural guidance:
1. Behavior: Dress codes, etiquette
2. Connection: A verified historical fact
3. Local Secret: A known local custom or hidden spot"""
    }

    llm generateReport {
      model: "gemini-2.0-flash"
      prompt: """Trip Guardian Report for \${extractCity_output}.

Compile a comprehensive travel report with:
1. Weather Briefing
2. Safety Briefing
3. Cultural Guidance
4. Logistics & Timing Advice

Use data from: \${knowledgeCheck_output}, \${reviewSummarizer_output}, \${newsAlert_output}, \${geniusLoci_output}, \${checkWeather_output}"""
    }
  }

  edges {
    START -> getDate

    // Primary data flow only (removed context injection edges for cleaner visualization)
    getDate -> extractDetails
    getDate -> extractCity

    // extractDetails provides trip details to knowledgeCheck
    extractDetails -> knowledgeCheck

    // extractCity provides city name to data fetching nodes
    extractCity -> checkWeather
    extractCity -> fetchReviews
    extractCity -> knowledgeCheck
    extractCity -> newsAlert
    extractCity -> geniusLoci

    // fetchReviews provides data to reviewSummarizer
    fetchReviews -> reviewSummarizer

    // All analysis results flow to generateReport
    checkWeather -> generateReport
    knowledgeCheck -> generateReport
    reviewSummarizer -> generateReport
    newsAlert -> generateReport
    geniusLoci -> generateReport

    generateReport -> END
  }
}`
};

/**
 * Get the raw M Language content for a template
 */
export function getTemplateContent(fileName: string): string | null {
  return MLANG_TEMPLATES[fileName] || null;
}

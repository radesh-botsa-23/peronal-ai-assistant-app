import { config } from "../config.mjs";

const FIREFLIES_API_URL = "https://api.fireflies.ai/graphql";

/**
 * Fireflies.ai API Client
 * Uses GraphQL API to fetch meeting transcripts, summaries, and participants.
 */

/**
 * Execute a GraphQL query against Fireflies API.
 * @param {string} query - GraphQL query string
 * @param {object} variables - Query variables
 * @returns {Promise<object>}
 */
async function graphqlRequest(query, variables = {}) {
  const response = await fetch(FIREFLIES_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${config.fireflies.apiKey}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`Fireflies API error: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();

  if (result.errors) {
    throw new Error(`Fireflies GraphQL error: ${result.errors[0].message}`);
  }

  return result.data;
}

/**
 * Fetch recent meeting transcripts.
 * @param {number} limit - Max number of transcripts (max 50)
 * @param {number} skip - Number to skip (for pagination)
 * @returns {Promise<Array>}
 */
export async function getTranscripts(limit = 20, skip = 0) {
  const query = `
    query Transcripts($limit: Int, $skip: Int) {
      transcripts(limit: $limit, skip: $skip) {
        id
        title
        date
        duration
        host_email
        organizer_email
        participants
        transcript_url
        speakers {
          id
          name
        }
        meeting_attendees {
          displayName
          email
          name
        }
        summary {
          keywords
          action_items
          overview
          short_summary
          bullet_gist
          topics_discussed
        }
        sentences {
          speaker_name
          text
          start_time
          end_time
        }
      }
    }
  `;

  const data = await graphqlRequest(query, { limit, skip });
  return data.transcripts || [];
}

/**
 * Fetch a single transcript by ID.
 * @param {string} transcriptId
 * @returns {Promise<object>}
 */
export async function getTranscript(transcriptId) {
  const query = `
    query Transcript($transcriptId: String!) {
      transcript(id: $transcriptId) {
        id
        title
        date
        duration
        host_email
        organizer_email
        participants
        transcript_url
        speakers {
          id
          name
        }
        meeting_attendees {
          displayName
          email
          name
        }
        summary {
          keywords
          action_items
          overview
          short_summary
          bullet_gist
          topics_discussed
        }
        sentences {
          speaker_name
          text
          start_time
          end_time
        }
      }
    }
  `;

  const data = await graphqlRequest(query, { transcriptId });
  return data.transcript;
}

/**
 * Fetch transcripts from a specific date range.
 * @param {string} fromDate - ISO date string
 * @param {string} toDate - ISO date string
 * @param {number} limit
 * @returns {Promise<Array>}
 */
export async function getTranscriptsByDateRange(fromDate, toDate, limit = 20) {
  const query = `
    query Transcripts($fromDate: DateTime, $toDate: DateTime, $limit: Int) {
      transcripts(fromDate: $fromDate, toDate: $toDate, limit: $limit) {
        id
        title
        date
        duration
        host_email
        participants
        speakers {
          id
          name
        }
        meeting_attendees {
          displayName
          email
          name
        }
        summary {
          keywords
          action_items
          overview
          short_summary
          topics_discussed
        }
      }
    }
  `;

  const data = await graphqlRequest(query, { fromDate, toDate, limit });
  return data.transcripts || [];
}

/**
 * Fetch transcripts by participant email.
 * @param {string} email - Participant email
 * @param {number} limit
 * @returns {Promise<Array>}
 */
export async function getTranscriptsByParticipant(email, limit = 10) {
  const query = `
    query Transcripts($participants: [String], $limit: Int) {
      transcripts(participants: $participants, limit: $limit) {
        id
        title
        date
        duration
        participants
        speakers {
          name
        }
        meeting_attendees {
          displayName
          email
        }
        summary {
          action_items
          overview
          short_summary
          topics_discussed
        }
      }
    }
  `;

  const data = await graphqlRequest(query, { participants: [email], limit });
  return data.transcripts || [];
}

/**
 * Format a transcript into a readable meeting summary.
 * @param {object} transcript
 * @returns {string}
 */
export function formatTranscript(transcript) {
  const date = new Date(transcript.date).toLocaleString();
  const duration = transcript.duration ? Math.round(transcript.duration / 60) : 0;
  const participants = transcript.meeting_attendees?.map(a => a.displayName || a.name || a.email).join(", ") || transcript.participants?.join(", ") || "Unknown";
  const speakers = transcript.speakers?.map(s => s.name).join(", ") || "";

  let summary = `## ${transcript.title}\n`;
  summary += `**Date:** ${date}\n`;
  summary += `**Duration:** ${duration} minutes\n`;
  summary += `**Participants:** ${participants}\n`;
  if (speakers) summary += `**Speakers:** ${speakers}\n`;
  summary += `\n`;

  if (transcript.summary?.overview) {
    summary += `### Overview\n${transcript.summary.overview}\n\n`;
  } else if (transcript.summary?.short_summary) {
    summary += `### Summary\n${transcript.summary.short_summary}\n\n`;
  }

  if (transcript.summary?.action_items?.length > 0) {
    summary += `### Action Items\n`;
    for (const item of transcript.summary.action_items) {
      summary += `- ${item}\n`;
    }
    summary += `\n`;
  }

  if (transcript.summary?.topics_discussed?.length > 0) {
    summary += `### Topics Discussed\n`;
    for (const topic of transcript.summary.topics_discussed) {
      summary += `- ${topic}\n`;
    }
    summary += `\n`;
  }

  return summary;
}

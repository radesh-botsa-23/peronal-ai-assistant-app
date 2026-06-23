# Requirements Document

## Introduction

A multi-channel Personal AI Assistant for Workplace Productivity that collects information from enterprise communication platforms (Gmail, Microsoft Teams, WhatsApp), stores it in a centralized memory system (GBrain), and allows users to retrieve insights through natural language conversations via Discord. The assistant provides summaries, action items, reminders, and contextual answers by orchestrating multiple specialized agents through OpenClaw and GStack, with Gemini as the reasoning LLM.

## Glossary

- **Discord_Bot**: The primary user-facing interface that receives natural language commands from users and delivers AI-generated responses in Discord channels
- **OpenClaw**: The agent runtime and communication layer that receives commands from the Discord Bot and routes them to the appropriate workflow agents
- **GStack**: The workflow and multi-agent orchestration engine that coordinates specialized agents to fulfill user requests
- **GBrain**: The long-term knowledge storage system that provides semantic search and retrieval of stored information using vector embeddings
- **Gemini**: The large language model used for reasoning, summarization, and generating natural language responses
- **Email_Agent**: A specialized GStack agent responsible for searching email memory, filtering relevant emails, and extracting action items from stored emails
- **Teams_Agent**: A specialized GStack agent responsible for retrieving meeting information, chat history, and extracting meeting outcomes from Microsoft Teams data
- **Memory_Agent**: A specialized GStack agent responsible for searching GBrain and retrieving contextual information across all data sources
- **Summary_Agent**: A specialized GStack agent responsible for generating concise summaries, meeting briefs, and daily reports
- **Task_Extraction_Agent**: A specialized GStack agent responsible for identifying action items, deadlines, and tracking pending work across all data sources
- **User**: A person interacting with the Discord Bot using natural language commands to retrieve information and insights

## Requirements

### Requirement 1: Discord Command Interface

**User Story:** As a User, I want to send natural language commands in Discord and receive intelligent AI-generated responses, so that I can query my emails, meetings, and messages without leaving my communication platform.

#### Acceptance Criteria

1. WHEN the User sends a message in the designated Discord channel, THE Discord_Bot SHALL receive the message and forward it to OpenClaw within 2 seconds
2. WHEN OpenClaw receives a command from the Discord_Bot, THE OpenClaw SHALL parse the user intent and route the request to the GStack workflow agent matching the identified intent category (email, meetings, tasks, or cross-source retrieval)
3. WHEN the GStack workflow completes processing, THE Discord_Bot SHALL deliver the response to the User in the same Discord channel within 10 seconds of the original command, splitting responses that exceed 2000 characters into sequential messages
4. IF the Discord_Bot fails to connect to OpenClaw, THEN THE Discord_Bot SHALL notify the User with an error message indicating the service is temporarily unavailable
5. IF OpenClaw cannot determine the user intent from the command after 2 consecutive clarification attempts, THEN THE OpenClaw SHALL return a message indicating the request could not be understood and suggest the User try a different phrasing or use a more specific command
6. IF the GStack workflow does not complete within 10 seconds of the original command, THEN THE Discord_Bot SHALL notify the User with an error message indicating the request timed out and suggest trying again

### Requirement 2: Email Semantic Search

**User Story:** As a User, I want to search my emails using natural language queries, so that I can find relevant email conversations without remembering exact keywords or senders.

#### Acceptance Criteria

1. WHEN the User sends a search command (e.g., "search emails about project deadline"), THE Email_Agent SHALL query GBrain using semantic search and return the top 5 most relevant email results ranked by semantic similarity score
2. WHEN the User searches emails by sender (e.g., "search emails from John"), THE Email_Agent SHALL filter results from GBrain to include only emails where the sender name or email address contains the specified sender text (case-insensitive partial match) and return a maximum of 10 results ordered by date descending
3. WHEN the User searches emails by both topic and sender (e.g., "search emails from John about project deadline"), THE Email_Agent SHALL apply semantic search filtered to only emails matching the specified sender and return the top 5 most relevant results
4. WHEN the Email_Agent retrieves search results from GBrain, THE Summary_Agent SHALL format each result displaying: subject line, sender name, date, and a content snippet of no more than 150 characters
5. IF no matching emails are found in GBrain for the search query, THEN THE Email_Agent SHALL inform the User that no relevant emails were found and suggest broadening the search terms

### Requirement 3: Email Summarization

**User Story:** As a User, I want to get AI-generated summaries of my emails, so that I can quickly understand the key points without reading every email individually.

#### Acceptance Criteria

1. WHEN the User requests a daily summary (e.g., "summarize today's emails"), THE Email_Agent SHALL retrieve up to 100 emails from GBrain for the current date and pass them to Gemini for summarization
2. WHEN Gemini receives emails for summarization, THE Gemini SHALL generate a summary of no more than 500 words organized by category: action required, important communications, and informational messages
3. WHEN the User requests important emails (e.g., "show important emails"), THE Email_Agent SHALL retrieve emails from GBrain for the past 24 hours and THE Summary_Agent SHALL rank them by priority based on sender, subject keywords, and urgency indicators (e.g., words such as "urgent", "deadline", "ASAP", or "immediate") and return the top 10 highest-priority results
4. IF no emails exist in GBrain for the requested date, THEN THE Email_Agent SHALL inform the User that no emails are available for that date
5. IF Gemini fails to generate a summary or does not respond within 15 seconds, THEN THE Email_Agent SHALL inform the User that summarization is temporarily unavailable and suggest retrying the request

### Requirement 4: Action Item Extraction

**User Story:** As a User, I want the assistant to automatically identify and track action items from my emails, so that I never miss a task or deadline.

#### Acceptance Criteria

1. WHEN the User requests pending action items (e.g., "show pending action items"), THE Task_Extraction_Agent SHALL query GBrain for emails from the last 7 days containing task indicators (explicit requests, deadlines, commitments, or phrases such as "please do", "by [date]", "action required", "follow up") and extract up to 20 action items
2. WHEN the Task_Extraction_Agent identifies action items, THE Task_Extraction_Agent SHALL extract for each action item: a task description of no more than 200 characters, the source email subject, the sender name, and the deadline if one is mentioned in the email
3. WHEN action items are extracted, THE Summary_Agent SHALL present them to the User as a numbered list ordered by deadline proximity (earliest deadline first), with action items that have no deadline listed at the end in reverse chronological order by email date
4. IF no action items are found in the stored emails from the last 7 days, THEN THE Task_Extraction_Agent SHALL inform the User that no pending action items were detected and suggest expanding the search range

### Requirement 5: Email Ingestion Pipeline

**User Story:** As a User, I want my emails to be automatically collected from Gmail and stored in GBrain with semantic embeddings, so that the AI assistant has up-to-date knowledge for answering my queries.

#### Acceptance Criteria

1. WHEN the email ingestion pipeline runs, THE Email_Agent SHALL fetch up to 50 emails from Gmail using the Gmail API that are not already stored in GBrain (identified by Gmail message ID), and store each email as a document in GBrain with metadata (sender, subject, date, snippet)
2. WHEN an email is stored in GBrain, THE GBrain SHALL generate vector embeddings for the email content (sender, subject, and snippet fields) to enable semantic search
3. THE Email_Agent SHALL run the ingestion pipeline on a configurable schedule (default: every 30 minutes) to keep GBrain up to date with new emails
4. IF the Gmail API returns an authentication error during ingestion, THEN THE Email_Agent SHALL log the error and retry authentication using the stored refresh token up to 3 times with a 10-second delay between attempts
5. IF a duplicate email (same message ID) already exists in GBrain, THEN THE Email_Agent SHALL skip the duplicate without overwriting the existing entry
6. IF the refresh token retry attempts are exhausted without successful authentication, THEN THE Email_Agent SHALL log an error message indicating authentication failure and abort the current ingestion run
7. IF GBrain storage fails for a specific email, THEN THE Email_Agent SHALL log an error message indicating the failed email message ID and continue processing the remaining emails in the batch

### Requirement 6: GStack Workflow Orchestration

**User Story:** As a User, I want my requests to be intelligently routed to the right specialized agent, so that I get accurate and contextual responses regardless of the type of query.

#### Acceptance Criteria

1. WHEN OpenClaw forwards a request to GStack, THE GStack SHALL analyze the request content and select one or more specialized agents (Email_Agent, Teams_Agent, Memory_Agent, Summary_Agent, or Task_Extraction_Agent) based on matching the request intent to the agent's defined responsibility within 3 seconds
2. WHEN a request requires multiple agents (e.g., summarizing emails and extracting action items), THE GStack SHALL orchestrate up to 5 agents sequentially, passing the output of each completed agent as input to the next agent in the sequence, with a maximum total orchestration time of 30 seconds
3. WHEN a specialized agent other than the Summary_Agent completes its task as the final step in the workflow, THE GStack SHALL pass the results to the Summary_Agent for formatting before returning the response to OpenClaw
4. IF a specialized agent encounters an error during processing, THEN THE GStack SHALL log the error, skip the failed agent, and return the results from previously completed agents in the sequence with a notification indicating which agent failed and that some information may be incomplete
5. IF GStack cannot match the request to any specialized agent, THEN THE GStack SHALL return a response to OpenClaw indicating that the request type is not supported and listing the types of queries the system can handle

### Requirement 7: Microsoft Teams Integration

**User Story:** As a User, I want the assistant to collect and store information from Microsoft Teams meetings and chats, so that I can query meeting summaries, participants, and action items through Discord.

#### Acceptance Criteria

1. THE Teams_Agent SHALL run the Teams integration pipeline on a configurable schedule (default: every 30 minutes) to collect meeting chat messages, meeting summaries, participant lists, and shared document references from Microsoft Teams using the Teams API
2. WHEN Teams data is collected, THE Teams_Agent SHALL store each data item in GBrain with metadata (meeting title, date, participants, type of content) and THE GBrain SHALL generate vector embeddings for the content to enable semantic search
3. WHEN the User queries Teams-related information (e.g., "what was discussed in yesterday's standup"), THE Teams_Agent SHALL search GBrain for relevant Teams data and return the top 5 most relevant matching results
4. IF the Microsoft Teams API returns an authorization error, THEN THE Teams_Agent SHALL log the error and retry authentication using the stored refresh token before notifying the User that Teams data is temporarily unavailable
5. IF a duplicate Teams data item (same meeting ID and content type) already exists in GBrain, THEN THE Teams_Agent SHALL skip the duplicate without overwriting the existing entry

### Requirement 8: Meeting Preparation Assistant

**User Story:** As a User, I want the assistant to generate a meeting preparation brief before my scheduled meetings, so that I can walk into meetings fully informed about related context.

#### Acceptance Criteria

1. WHEN the User requests a meeting brief (e.g., "prepare me for the project sync meeting"), THE Memory_Agent SHALL search GBrain for emails, previous meeting notes, Teams messages, and action items semantically matching the meeting topic from the last 30 days, returning up to 10 relevant items per source type
2. WHEN relevant context is gathered, THE Summary_Agent SHALL generate a meeting brief of no more than 500 words containing: discussion points from prior meetings (up to 5 most recent), unresolved action items, emails from the last 14 days related to the topic, and 3 to 5 suggested talking points
3. WHEN the meeting brief is generated, THE Discord_Bot SHALL deliver the brief to the User within 15 seconds of the original request, formatted with labeled sections: Prior Discussion Points, Unresolved Action Items, Recent Emails, and Suggested Talking Points
4. IF fewer than 2 relevant items are found across all sources in GBrain for the meeting topic, THEN THE Summary_Agent SHALL inform the User that limited prior context is available and present the items that were found along with their source attribution
5. IF the Memory_Agent fails to retrieve data from one or more sources during the search, THEN THE Summary_Agent SHALL generate the brief using the available sources and indicate which sources were unavailable

### Requirement 9: WhatsApp Message Integration

**User Story:** As a User, I want the assistant to collect messages from selected WhatsApp chats and store them in GBrain, so that I can search and summarize WhatsApp conversations alongside my other communication data.

#### Acceptance Criteria

1. WHEN the WhatsApp integration pipeline runs, THE Memory_Agent SHALL collect messages from user-configured WhatsApp chats and store them in GBrain with metadata (chat name, sender, timestamp, message type)
2. THE Memory_Agent SHALL run the WhatsApp ingestion pipeline on a configurable schedule (default: every 30 minutes) to keep GBrain up to date with new messages
3. WHEN the User queries WhatsApp-related information (e.g., "search WhatsApp messages about project update"), THE Memory_Agent SHALL search GBrain for relevant WhatsApp messages and return the top 5 most relevant results
4. WHEN the User requests a WhatsApp chat summary, THE Summary_Agent SHALL retrieve messages from the specified chat within the last 24 hours (or up to 50 messages, whichever is fewer) and generate a summary using Gemini
5. THE User SHALL be able to configure which WhatsApp chats are collected through a settings command in Discord
6. IF the WhatsApp API returns an authentication or connection error during ingestion, THEN THE Memory_Agent SHALL log the error and notify the User that WhatsApp data is temporarily unavailable
7. IF the User requests a summary for a chat that is not in the configured collection list, THEN THE Memory_Agent SHALL inform the User that the specified chat is not configured for collection and suggest using the settings command to add it

### Requirement 10: Voice Command Interface

**User Story:** As a User, I want to interact with the assistant using voice commands, so that I can retrieve information hands-free.

#### Acceptance Criteria

1. WHEN the User sends a voice message of 60 seconds or less in duration, THE Discord_Bot SHALL transcribe the audio using a Speech-to-Text service and forward the transcribed text to OpenClaw as a standard command within 5 seconds of receiving the voice message
2. WHEN the transcribed command is processed and the response text is 500 characters or fewer, THE Discord_Bot SHALL deliver the response both as text and as a Text-to-Speech audio message
3. WHEN the transcribed command is processed and the response text exceeds 500 characters, THE Discord_Bot SHALL deliver the response as text only
4. IF the Speech-to-Text service returns a transcription confidence score below 70%, THEN THE Discord_Bot SHALL ask the User to repeat the command or type it instead
5. IF the Speech-to-Text service is unreachable or returns a service error, THEN THE Discord_Bot SHALL notify the User that voice commands are temporarily unavailable and suggest typing the command instead
6. IF the User sends a voice message exceeding 60 seconds in duration, THEN THE Discord_Bot SHALL notify the User that the voice message exceeds the maximum supported length and request a shorter message

### Requirement 11: Cross-Source Context Retrieval

**User Story:** As a User, I want the assistant to combine information from multiple sources (emails, Teams, WhatsApp) when answering my queries, so that I get comprehensive answers with full context.

#### Acceptance Criteria

1. WHEN the User asks a general question (e.g., "what do I know about the product launch"), THE Memory_Agent SHALL search GBrain across all data sources (emails, Teams, WhatsApp) and return the top 10 most relevant results ranked by semantic similarity regardless of source
2. WHEN results come from multiple sources, THE Summary_Agent SHALL organize the response by source type (emails, Teams, WhatsApp), include the source attribution and date for each item, and present a unified summary using Gemini not exceeding 500 words
3. THE GBrain SHALL maintain source metadata for each stored document including: source platform (email, Teams, or WhatsApp), original author, timestamp, and document title or subject
4. IF no matching results are found in GBrain across any data source for the User's query, THEN THE Memory_Agent SHALL inform the User that no relevant information was found and suggest refining the query with more specific terms
5. IF one or more data sources are unavailable during the cross-source search, THEN THE Memory_Agent SHALL return results from the available sources and notify the User which sources could not be searched

### Requirement 12: Daily Productivity Report

**User Story:** As a User, I want to receive a daily productivity report summarizing my emails, meetings, and pending tasks, so that I can start each day with a clear overview of priorities.

#### Acceptance Criteria

1. WHEN the User requests a daily report (e.g., "give me my daily report"), THE Summary_Agent SHALL collect emails received since midnight local time, meetings scheduled within the next 24 hours, and pending action items from GBrain
2. WHEN the daily report data is collected, THE Summary_Agent SHALL generate a structured report with sections: up to 10 email highlights (selected by sender priority and urgency indicators), up to 10 upcoming meetings (within the next 24 hours with title, time, and participants), up to 10 pending action items (ordered by deadline proximity), and up to 5 suggested priorities (ranked by deadline proximity and urgency indicators)
3. WHERE the User enables automatic daily reports, THE Discord_Bot SHALL deliver the daily report to the User at the User-configured time (default: 08:00 local time) each morning without requiring a manual command
4. IF one or more data sources (emails, meetings, or action items) contain no data for the report period, THEN THE Summary_Agent SHALL generate the report with the available sections and indicate which sections had no data

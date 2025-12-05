export const userPath = (userId: string) => `users/${userId}`;
export const contactsPath = (userId: string) =>
  `users/${userId}/contacts`;
export const contactDoc = (userId: string, contactId: string) =>
  `users/${userId}/contacts/${contactId}`;

export const threadsPath = (userId: string) =>
  `users/${userId}/threads`;
export const threadDoc = (userId: string, threadId: string) =>
  `users/${userId}/threads/${threadId}`;

export const messagesPath = (userId: string, threadId: string) =>
  `users/${userId}/threads/${threadId}/messages`;
export const messageDoc = (userId: string, threadId: string, messageId: string) =>
  `users/${userId}/threads/${threadId}/messages/${messageId}`;

export const syncJobsPath = (userId: string) =>
  `users/${userId}/syncJobs`;
export const syncJobDoc = (userId: string, syncJobId: string) =>
  `users/${userId}/syncJobs/${syncJobId}`;

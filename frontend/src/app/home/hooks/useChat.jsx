// src/app/home/hooks/useChat.js
// This hook is no longer needed since WebSocket and messages are managed globally in HomePage.
// You can safely delete this file and remove all imports of useChat from your project.

// If you want to keep a chat-related hook, you can create a simple helper for filtering messages for a chat:
//
// export function useChatMessages(messages, currentUser, recipient) {
//   return messages.filter(
//     (msg) =>
//       (msg.from === currentUser.ID && msg.to === recipient.ID) ||
//       (msg.to === currentUser.ID && msg.from === recipient.ID)
//   );
// }

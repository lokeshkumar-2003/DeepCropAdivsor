import React, { useState, useEffect } from "react";
import { Sprout, User } from "lucide-react";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
  isStreaming?: boolean;
};

type ChatMessageProps = {
  message: Message;
};

function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";
  const [displayedContent, setDisplayedContent] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (message.isStreaming && !isUser) {
      // Streaming effect for assistant messages
      if (currentIndex < message.content.length) {
        const timeout = setTimeout(() => {
          setDisplayedContent(message.content.slice(0, currentIndex + 1));
          setCurrentIndex(currentIndex + 1);
        }, 20); // Adjust speed here (lower = faster)

        return () => clearTimeout(timeout);
      }
    } else {
      // Show full content immediately if not streaming
      setDisplayedContent(message.content);
    }
  }, [currentIndex, message.content, message.isStreaming, isUser]);

  // Reset when message changes
  useEffect(() => {
    setCurrentIndex(0);
    if (!message.isStreaming || isUser) {
      setDisplayedContent(message.content);
    } else {
      setDisplayedContent("");
    }
  }, [message.id]);

  const renderContent = (content: string) => {
    // Simple markdown-like rendering
    const lines = content.split("\n");
    return lines.map((line, idx) => {
      // Headers
      if (line.startsWith("### ")) {
        return (
          <h3 key={idx} className="text-lg font-bold mt-4 mb-2">
            {line.slice(4)}
          </h3>
        );
      }
      if (line.startsWith("## ")) {
        return (
          <h2 key={idx} className="text-xl font-bold mt-4 mb-2">
            {line.slice(3)}
          </h2>
        );
      }
      if (line.startsWith("# ")) {
        return (
          <h1 key={idx} className="text-2xl font-bold mt-4 mb-2">
            {line.slice(2)}
          </h1>
        );
      }

      // Bold
      const boldFormatted = line.replace(
        /\*\*(.*?)\*\*/g,
        "<strong>$1</strong>",
      );

      // Bullet points
      if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
        return (
          <li
            key={idx}
            className="ml-4 mb-1"
            dangerouslySetInnerHTML={{ __html: boldFormatted.slice(2) }}
          />
        );
      }

      // Numbered lists
      if (/^\d+\.\s/.test(line.trim())) {
        return (
          <li
            key={idx}
            className="ml-4 mb-1 list-decimal"
            dangerouslySetInnerHTML={{
              __html: boldFormatted.replace(/^\d+\.\s/, ""),
            }}
          />
        );
      }

      // Regular paragraphs
      if (line.trim()) {
        return (
          <p
            key={idx}
            className="mb-2"
            dangerouslySetInnerHTML={{ __html: boldFormatted }}
          />
        );
      }

      return <br key={idx} />;
    });
  };

  return (
    <div
      className={`flex items-start gap-4 ${isUser ? "flex-row-reverse" : ""} animate-fadeIn`}
    >
      {/* Avatar */}
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 shadow-md ${
          isUser
            ? "bg-gradient-to-br from-blue-500 to-blue-600"
            : "bg-gradient-to-br from-green-500 to-emerald-600"
        }`}
      >
        {isUser ? (
          <User className="w-5 h-5 text-white" />
        ) : (
          <Sprout className="w-5 h-5 text-white" />
        )}
      </div>

      {/* Message Content */}
      <div
        className={`flex-1 max-w-[85%] ${isUser ? "items-end" : "items-start"}`}
      >
        <div
          className={`rounded-2xl px-5 py-3 shadow-sm ${
            isUser
              ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white ml-auto"
              : "bg-white border border-gray-200 text-gray-800"
          }`}
        >
          {message.imageUrl && (
            <img
              src={message.imageUrl}
              alt="Uploaded crop"
              className="rounded-xl mb-3 max-w-full h-auto max-h-80 object-cover shadow-md border-2 border-white/20"
            />
          )}

          <div
            className={`leading-relaxed ${isUser ? "text-white" : "text-gray-800"}`}
          >
            {renderContent(displayedContent)}
            {message.isStreaming && currentIndex < message.content.length && (
              <span className="inline-block w-1 h-4 bg-green-600 animate-pulse ml-1"></span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ChatMessage;

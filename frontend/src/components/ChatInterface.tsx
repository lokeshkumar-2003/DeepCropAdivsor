import { useState, useRef, useEffect } from "react";
import {
  Send,
  Loader2,
  Sprout,
  User,
  Upload,
  MapPin,
  Maximize,
  Camera,
  RefreshCw,
  AlertCircle,
  Trash2,
} from "lucide-react";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
  isStreaming?: boolean;
};

type ConversationStep = "upload" | "location" | "landsize" | "complete";

const LANGUAGES = [
  { value: "english", label: "🇬🇧 English" },
  { value: "tamil", label: "🇮🇳 தமிழ்" },
  { value: "hindi", label: "🇮🇳 हिंदी" },
  { value: "telugu", label: "🇮🇳 తెలుగు" },
  { value: "kannada", label: "🇮🇳 ಕನ್ನಡ" },
  { value: "malayalam", label: "🇮🇳 മലയാളം" },
];

const INITIAL_MESSAGE: Message = {
  id: "1",
  role: "assistant",
  content:
    "Hello! 🌾 I'm your **DeepCrop Advisor Assistant**. I'm here to help diagnose crop issues and provide expert agricultural advice.\n\nPlease upload a clear image of your crop to begin the analysis.",
};

const GEO_API_KEY = "18811fce8d6774ba98d02872e3097527";

const validateLocationFormat = (
  location: string,
): { isValid: boolean; error?: string } => {
  const t = location.trim();
  if (!t) return { isValid: false, error: "Location cannot be empty" };
  if (t.length < 2)
    return { isValid: false, error: "Location name is too short" };
  if (/^\d+$/.test(t))
    return { isValid: false, error: "Location name cannot be only numbers" };
  if (!/[a-zA-Z]/.test(t))
    return { isValid: false, error: "Location name must contain letters" };
  if (!/^[a-zA-Z0-9\s,.\-]+$/.test(t))
    return { isValid: false, error: "Location contains invalid characters" };
  return { isValid: true };
};

const verifyLocationWithAPI = async (
  location: string,
): Promise<{ isValid: boolean; resolvedName?: string; error?: string }> => {
  try {
    const url = `https://api.openweathermap.org/geo/1.0/direct?limit=1&appid=${GEO_API_KEY}&q=${encodeURIComponent(location)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("API error");
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      return {
        isValid: false,
        error: `"${location}" was not found. Please enter a valid place name (e.g., "Punjab, India" or "Chennai").`,
      };
    }
    const place = data[0];
    const resolvedName = [place.name, place.state, place.country]
      .filter(Boolean)
      .join(", ");
    return { isValid: true, resolvedName };
  } catch {
    return { isValid: true, resolvedName: location };
  }
};

const validateLandSize = (
  size: string,
): { isValid: boolean; error?: string } => {
  const t = size.trim();
  if (!t) return { isValid: false, error: "Land size cannot be empty" };
  const n = parseFloat(t);
  if (isNaN(n))
    return { isValid: false, error: "Land size must be a valid number" };
  if (n <= 0)
    return { isValid: false, error: "Land size must be greater than 0" };
  if (n > 10000)
    return {
      isValid: false,
      error: "Land size seems too large. Please verify",
    };
  if ((t.split(".")[1] || "").length > 2)
    return {
      isValid: false,
      error: "Land size can have maximum 2 decimal places",
    };
  return { isValid: true };
};

// ─── Render markdown-lite content ─────────────────────────────────────────────
function renderContent(content: string): JSX.Element[] {
  const lines = content.split("\n");
  const elements: JSX.Element[] = [];
  let tableLines: string[] = [];
  let inTable = false;

  const flushTable = () => {
    if (!tableLines.length) return;
    const rows = tableLines
      .map((l) => l.trim())
      .filter((l) => l.startsWith("|") && l.endsWith("|"))
      .map((l) =>
        l
          .slice(1, -1)
          .split("|")
          .map((c) => c.trim()),
      );
    if (rows.length) {
      const hasSep =
        rows.length > 1 && rows[1].every((c) => /^[-:\s]+$/.test(c));
      const header = rows[0];
      const body = hasSep ? rows.slice(2) : rows.slice(1);
      elements.push(
        <div key={`tbl-${elements.length}`} className="my-3 overflow-x-auto">
          <table className="min-w-full border border-gray-300 rounded-lg text-sm">
            <thead className="bg-green-50">
              <tr>
                {header.map((c, i) => (
                  <th
                    key={i}
                    className="px-3 py-2 text-left font-semibold text-gray-700 border-b border-gray-300"
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((row, ri) => (
                <tr
                  key={ri}
                  className={ri % 2 === 0 ? "bg-white" : "bg-gray-50"}
                >
                  {row.map((c, ci) => (
                    <td
                      key={ci}
                      className="px-3 py-2 border-b border-gray-200"
                      dangerouslySetInnerHTML={{
                        __html: c.replace(
                          /\*\*(.*?)\*\*/g,
                          "<strong>$1</strong>",
                        ),
                      }}
                    />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
    }
    tableLines = [];
    inTable = false;
  };

  lines.forEach((line, idx) => {
    if (line.includes("|")) {
      inTable = true;
      tableLines.push(line);
      return;
    }
    if (inTable) flushTable();

    const bold = (s: string) =>
      s.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

    if (line.startsWith("### ")) {
      elements.push(
        <h3 key={idx} className="text-base font-bold mt-3 mb-1">
          {line.slice(4)}
        </h3>,
      );
      return;
    }
    if (line.startsWith("## ")) {
      elements.push(
        <h2 key={idx} className="text-lg font-bold mt-3 mb-1">
          {line.slice(3)}
        </h2>,
      );
      return;
    }
    if (line.startsWith("# ")) {
      elements.push(
        <h1 key={idx} className="text-xl font-bold mt-3 mb-2">
          {line.slice(2)}
        </h1>,
      );
      return;
    }

    if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
      elements.push(
        <li
          key={idx}
          className="ml-4 mb-0.5"
          dangerouslySetInnerHTML={{
            __html: bold(line.trim().replace(/^[-*]\s/, "")),
          }}
        />,
      );
      return;
    }
    if (/^\d+\.\s/.test(line.trim())) {
      elements.push(
        <li
          key={idx}
          className="ml-4 mb-0.5 list-decimal"
          dangerouslySetInnerHTML={{
            __html: bold(line.trim().replace(/^\d+\.\s/, "")),
          }}
        />,
      );
      return;
    }
    if (line.trim()) {
      elements.push(
        <p
          key={idx}
          className="mb-1.5"
          dangerouslySetInnerHTML={{ __html: bold(line) }}
        />,
      );
      return;
    }
    elements.push(<br key={idx} />);
  });
  flushTable();
  return elements;
}

// ─── ChatMessage ──────────────────────────────────────────────────────────────
function ChatMessage({ message }: { message: Message }) {
  const isUser = message.role === "user";
  // For assistant messages with isStreaming flag we do character-by-character reveal
  const [displayed, setDisplayed] = useState(
    isUser || !message.isStreaming ? message.content : "",
  );
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    setIdx(0);
    setDisplayed(isUser || !message.isStreaming ? message.content : "");
  }, [message.id]);

  useEffect(() => {
    if (!message.isStreaming || isUser) {
      setDisplayed(message.content);
      return;
    }
    if (idx < message.content.length) {
      const t = setTimeout(() => {
        setDisplayed(message.content.slice(0, idx + 4));
        setIdx(idx + 4);
      }, 8);
      return () => clearTimeout(t);
    } else {
      setDisplayed(message.content);
    }
  }, [idx, message.content, message.isStreaming, isUser]);

  return (
    <div
      className={`flex items-start gap-3 ${isUser ? "flex-row-reverse" : ""} animate-fadeIn`}
    >
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isUser ? "bg-gradient-to-br from-blue-500 to-blue-600" : "bg-gradient-to-br from-green-500 to-emerald-600"}`}
      >
        {isUser ? (
          <User className="w-4 h-4 text-white" />
        ) : (
          <Sprout className="w-4 h-4 text-white" />
        )}
      </div>
      <div
        className={`flex-1 ${isUser ? "max-w-[75%] ml-auto" : "max-w-[85%]"}`}
      >
        <div
          className={`rounded-2xl px-4 py-2.5 ${isUser ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white" : "bg-white text-gray-800 shadow-sm border border-gray-100"}`}
        >
          {message.imageUrl && (
            <img
              src={message.imageUrl}
              alt="Uploaded crop"
              className="rounded-lg mb-2 w-full h-auto max-h-48 object-cover"
            />
          )}
          <div
            className={`text-sm leading-relaxed ${isUser ? "text-white" : "text-gray-800"}`}
          >
            {renderContent(displayed)}
            {message.isStreaming && idx < message.content.length && (
              <span className="inline-block w-0.5 h-3.5 bg-green-600 animate-pulse ml-0.5" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Live streaming message — appends real tokens from fetch stream ───────────
function LiveStreamMessage({
  streamRef,
  onDone,
}: {
  streamRef: React.MutableRefObject<string>;
  onDone: () => void;
}) {
  const [text, setText] = useState("");
  const doneRef = useRef(false);

  useEffect(() => {
    let raf: number;
    const tick = () => {
      setText(streamRef.current);
      if (!doneRef.current) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Signal parent when stream ends
  useEffect(() => {
    if (streamRef.current && text === streamRef.current) {
      const t = setTimeout(() => {
        doneRef.current = true;
        onDone();
      }, 300);
      return () => clearTimeout(t);
    }
  }, [text]);

  return (
    <div className="flex items-start gap-3 animate-fadeIn">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center flex-shrink-0">
        <Sprout className="w-4 h-4 text-white" />
      </div>
      <div className="flex-1 max-w-[85%]">
        <div className="rounded-2xl px-4 py-2.5 bg-white text-gray-800 shadow-sm border border-gray-100">
          <div className="text-sm leading-relaxed">
            {renderContent(text)}
            <span className="inline-block w-0.5 h-3.5 bg-green-600 animate-pulse ml-0.5" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ImageUpload ──────────────────────────────────────────────────────────────
function ImageUpload({
  onImageUpload,
  onClearAll,
  language,
  onLanguageChange,
}: {
  onImageUpload: (file: File) => void;
  onClearAll: () => void;
  language: string;
  onLanguageChange: (lang: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [previewName, setPreviewName] = useState<string | null>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file?.type.startsWith("image/")) {
      setPreviewName(file.name);
      onImageUpload(file);
    }
  };
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPreviewName(file.name);
      onImageUpload(file);
    }
    e.target.value = "";
  };

  return (
    <div className="flex items-center gap-3">
      <div
        className={`flex-1 relative border-2 border-dashed rounded-2xl cursor-pointer transition-all ${dragActive ? "border-green-500 bg-green-50" : "border-gray-300 bg-white hover:border-green-400 hover:bg-green-50/40"}`}
        onClick={() => fileInputRef.current?.click()}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleChange}
          className="hidden"
        />
        <div className="flex items-center gap-3 px-4 py-3">
          <Camera className="w-5 h-5 text-gray-400 flex-shrink-0" />
          <p className="text-sm text-gray-500 truncate">
            {previewName ?? "Drop image here or click to upload"}
          </p>
        </div>
      </div>

      <select
        value={language}
        onChange={(e) => onLanguageChange(e.target.value)}
        className="px-3 py-3 border-2 border-gray-300 rounded-full bg-white text-gray-700 text-sm font-medium focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100 transition-all cursor-pointer hover:border-green-400"
      >
        {LANGUAGES.map((l) => (
          <option key={l.value} value={l.value}>
            {l.label}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={() => {
          setPreviewName(null);
          onClearAll();
        }}
        className="bg-gradient-to-r from-red-400 to-rose-500 text-white px-5 py-3 rounded-full hover:from-red-500 hover:to-rose-600 transition-all shadow-md hover:shadow-lg flex items-center gap-2 whitespace-nowrap"
      >
        <Trash2 className="w-4 h-4" />
        <span className="font-medium">Clear</span>
      </button>

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-3 rounded-full hover:from-green-600 hover:to-emerald-700 transition-all shadow-md hover:shadow-lg flex items-center gap-2 whitespace-nowrap"
      >
        <Upload className="w-5 h-5" />
        <span className="font-medium">Upload</span>
      </button>
    </div>
  );
}

// ─── ChatInterface ────────────────────────────────────────────────────────────
export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [step, setStep] = useState<ConversationStep>("upload");
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [language, setLanguage] = useState("english");
  const [inputError, setInputError] = useState<string | null>(null);
  const [cropImage, setCropImage] = useState<File | null>(null);
  const [location, setLocation] = useState("");

  // Live stream buffer — shared between fetch loop and LiveStreamMessage via ref
  const streamBuffer = useRef<string>("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);
  useEffect(() => {
    if (inputError && input) setInputError(null);
  }, [input]);

  const addMessage = (
    role: "user" | "assistant",
    content: string,
    imageUrl?: string,
    streaming?: boolean,
  ) => {
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        role,
        content,
        imageUrl,
        isStreaming: streaming,
      },
    ]);
  };

  const resetFlow = () => {
    setStep("upload");
    setCropImage(null);
    setLocation("");
    setInputError(null);
  };

  const handleClearAll = () => {
    setMessages([{ ...INITIAL_MESSAGE, id: Date.now().toString() }]);
    setInput("");
    resetFlow();
  };

  const handleImageUpload = (file: File) => {
    setCropImage(file);
    addMessage("user", `📷 ${file.name}`, URL.createObjectURL(file));
    setTimeout(() => {
      addMessage(
        "assistant",
        "Great! 📍 Please share your **location** (city or region) for location-specific recommendations.\n\n**Example:** Punjab, India or Chennai, Tamil Nadu",
        undefined,
        true,
      );
      setStep("location");
    }, 300);
  };

  const handleSubmit = async (e: React.FormEvent | React.MouseEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || isStreaming) return;
    const userInput = input.trim();

    if (step === "location") {
      const fmt = validateLocationFormat(userInput);
      if (!fmt.isValid) {
        setInputError(fmt.error!);
        setTimeout(
          () =>
            addMessage(
              "assistant",
              `⚠️ **Invalid location:** ${fmt.error}\n\nPlease enter a valid place name (e.g., "Punjab, India" or "Chennai")`,
              undefined,
              true,
            ),
          100,
        );
        return;
      }
      addMessage("user", userInput);
      setInput("");
      setInputError(null);
      setIsLoading(true);

      const geo = await verifyLocationWithAPI(userInput);
      setIsLoading(false);

      if (!geo.isValid) {
        setInputError(
          "Location not recognised — please enter a proper place name.",
        );
        addMessage(
          "assistant",
          `📍 **Location not found:** ${geo.error}\n\nTry a well-known city or region like **"Chennai, Tamil Nadu"**, **"Punjab, India"**, or **"New Delhi"**.`,
          undefined,
          true,
        );
        return;
      }
      const confirmed = geo.resolvedName ?? userInput;
      setLocation(confirmed);
      setTimeout(() => {
        addMessage(
          "assistant",
          `✅ Location confirmed: **${confirmed}**\n\n📐 Finally, enter your **land size in acres** for accurate dosage recommendations.\n\n**Example:** 5 or 2.5`,
          undefined,
          true,
        );
        setStep("landsize");
      }, 300);
    } else if (step === "landsize") {
      const lv = validateLandSize(userInput);
      if (!lv.isValid) {
        setInputError(lv.error!);
        setTimeout(
          () =>
            addMessage(
              "assistant",
              `⚠️ **Invalid land size:** ${lv.error}\n\nPlease enter a valid number (e.g., "5" or "2.5")`,
              undefined,
              true,
            ),
          100,
        );
        return;
      }
      addMessage("user", userInput);
      setInput("");
      setInputError(null);
      setStep("complete");
      await callAPIStream(location, userInput);
    }
  };

  // ── Real token-by-token streaming from FastAPI SSE/plain-text stream ─────────
  const callAPIStream = async (
    locationValue: string,
    landSizeValue: string,
  ) => {
    if (!cropImage) {
      addMessage(
        "assistant",
        "⚠️ No image found. Please upload a crop image first.",
      );
      resetFlow();
      return;
    }

    streamBuffer.current = "";
    setIsStreaming(true);

    const formData = new FormData();
    formData.append("image_file", cropImage);
    formData.append("location_name", locationValue);
    formData.append("land_size_acre", landSizeValue);
    formData.append("language", language);

    try {
      // Try streaming endpoint first; fall back to regular endpoint
      const response = await fetch(
        "http://127.0.0.1:8000/predict-and-remedy-stream",
        {
          method: "POST",
          body: formData,
        },
      );

      if (!response.ok) throw new Error(`Server error ${response.status}`);
      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        // Strip SSE "data: " prefix if present
        const text = chunk.replace(/^data:\s*/gm, "").replace(/\n\n/g, "\n");
        streamBuffer.current += text;
      }
    } catch {
      // Fallback: regular non-streaming endpoint
      try {
        const formData2 = new FormData();
        formData2.append("image_file", cropImage);
        formData2.append("location_name", locationValue);
        formData2.append("land_size_acre", landSizeValue);
        formData2.append("language", language);

        const res = await fetch("http://127.0.0.1:8000/predict-and-remedy", {
          method: "POST",
          body: formData2,
        });
        if (!res.ok)
          throw new Error(`Server error ${res.status}: ${await res.text()}`);
        const data = await res.json();
        const text: string =
          data.advice ?? data.message ?? JSON.stringify(data);

        // Simulate streaming by writing characters gradually
        for (let i = 0; i < text.length; i += 6) {
          streamBuffer.current = text.slice(0, i + 6);
          await new Promise((r) => setTimeout(r, 12));
        }
        streamBuffer.current = text;
      } catch (err2: any) {
        streamBuffer.current = `❌ **Connection failed.**\n\nCould not reach the server.\n\n**Error:** ${err2?.message ?? "Unknown error"}\n\nPlease make sure the backend is running and try again.`;
      }
    }
  };

  // Called by LiveStreamMessage when streaming finishes
  const handleStreamDone = () => {
    const finalText = streamBuffer.current;
    setIsStreaming(false);
    addMessage("assistant", finalText);
    setMessages((prev) => prev); // flush
    setTimeout(() => {
      addMessage(
        "assistant",
        "Would you like to analyze another crop? Upload a new image anytime! 🌱",
        undefined,
        true,
      );
      resetFlow();
    }, 600);
  };

  const getPlaceholder = () => {
    if (step === "location") return "e.g., Punjab, India";
    if (step === "landsize") return "e.g., 5 or 2.5 acres";
    return "Type your message...";
  };

  return (
    <div className="flex flex-col w-screen h-screen bg-gradient-to-br from-slate-50 to-green-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 via-emerald-600 to-green-700 text-white shadow-md">
        <div className="px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-full flex items-center justify-center">
              <Sprout className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold">DeepCrop Advisor</h1>
              <p className="text-xs text-green-100">
                AI-Powered Crop Health Assistant
              </p>
            </div>
          </div>
          {step !== "upload" && (
            <button
              onClick={() => {
                resetFlow();
                addMessage(
                  "assistant",
                  "🔄 Session reset. Upload a new crop image to start again.",
                  undefined,
                  true,
                );
              }}
              className="flex items-center gap-1.5 text-xs bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-full transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Reset
            </button>
          )}
        </div>
      </div>

      {/* Step indicator */}
      <div className="bg-white border-b border-gray-100 px-6 py-2">
        <div className="max-w-4xl mx-auto flex items-center gap-2 text-xs text-gray-500">
          {[
            { key: "upload", label: "1. Upload Image" },
            { key: "location", label: "2. Location" },
            { key: "landsize", label: "3. Land Size" },
            { key: "complete", label: "4. Analysis" },
          ].map((s, i, arr) => (
            <div key={s.key} className="flex items-center gap-2">
              <span
                className={`font-medium ${step === s.key ? "text-green-600" : "text-gray-400"}`}
              >
                {s.label}
              </span>
              {i < arr.length - 1 && <span className="text-gray-300">›</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="max-w-4xl mx-auto space-y-4">
          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}

          {/* Real-time streaming message */}
          {isStreaming && (
            <LiveStreamMessage
              streamRef={streamBuffer}
              onDone={handleStreamDone}
            />
          )}

          {/* Location-verify spinner */}
          {isLoading && (
            <div className="flex items-start gap-3 animate-fadeIn">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                <Sprout className="w-4 h-4 text-white" />
              </div>
              <div className="bg-white border border-gray-100 rounded-2xl px-4 py-2.5 shadow-sm">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-green-600" />
                  <span className="text-sm text-gray-600">
                    Verifying location…
                  </span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input area */}
      <div className="border-t border-gray-200 bg-white/90 backdrop-blur shadow-lg">
        <div className="max-w-4xl mx-auto px-4 py-3">
          {step === "upload" ? (
            <ImageUpload
              onImageUpload={handleImageUpload}
              onClearAll={handleClearAll}
              language={language}
              onLanguageChange={setLanguage}
            />
          ) : (
            <div>
              {inputError && (
                <div className="flex items-center gap-2 text-red-600 text-sm mb-2 bg-red-50 px-3 py-2 rounded-lg animate-fadeIn">
                  <AlertCircle className="w-4 h-4" />
                  <span>{inputError}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmit(e as any);
                      }
                    }}
                    placeholder={getPlaceholder()}
                    className={`w-full pl-4 pr-10 py-3 border rounded-full focus:outline-none focus:ring-2 transition-all bg-white text-sm ${inputError ? "border-red-400 focus:border-red-500 focus:ring-red-100" : "border-gray-300 focus:border-green-500 focus:ring-green-100"}`}
                    disabled={isLoading || isStreaming}
                    autoFocus
                  />
                  {step === "location" && (
                    <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  )}
                  {step === "landsize" && (
                    <Maximize className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  )}
                </div>
                <button
                  onClick={handleSubmit}
                  disabled={!input.trim() || isLoading || isStreaming}
                  className="bg-gradient-to-r from-green-500 to-emerald-600 text-white p-3 rounded-full hover:from-green-600 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        .animate-fadeIn { animation: fadeIn 0.25s ease-out; }
      `}</style>
    </div>
  );
}

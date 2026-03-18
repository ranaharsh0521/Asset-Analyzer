import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Bot, User, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLiveAlerts } from "@/hooks/useLiveAlerts";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export function AIChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content: "🔴 LIVE GNN-IDS Assistant online! I analyze real-time alerts from your network. Ask me about current threats, attack stages, or risk scores.",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { alerts, networkStats } = useLiveAlerts();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const getLiveContext = () => {
    if (alerts.length === 0) return "No active alerts. Network normal.";
    
    const topAlert = alerts[0];
    const summary = `LIVE STATUS: ${alerts.length} alerts, anomaly rate ${networkStats.anomalyRate}%. TOP THREAT: ${topAlert.title} (${topAlert.src}→${topAlert.dst}) risk:${topAlert.riskScore.toFixed(2)}`;
    return summary;
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const liveContext = getLiveContext();
      const enhancedMessages = messages
        .filter((m) => m.id !== "1" || messages.length === 1)
        .map((m) => ({ role: m.role, content: m.content }))
        .concat({ role: "system" as any, content: `CONTEXT (updated ${new Date().toLocaleTimeString()}): ${liveContext}` });

      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: enhancedMessages,
          context: {
            alertsCount: alerts.length,
            topRisk: alerts[0]?.riskScore || 0,
            networkStats
          }
        }),
      });

      if (!response.ok) {
        throw new Error(`Server ${response.status}`);
      }

      const data = await response.json();
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.response || "No response received",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error: any) {
      console.error("Live chat error:", error);
      const errorMsg = error.message.includes('fetch') 
        ? "⚠️ Backend down - npm run dev"
        : `⚠️ Error: ${error.message}`;
      setMessages((prev) => [...prev, {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: errorMsg,
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Live Status Badge */}
      <div className="fixed bottom-20 right-6 z-40 text-xs bg-primary/90 text-primary-foreground px-2 py-1 rounded-full shadow-lg">
        {alerts.length} alerts | {networkStats.anomalyRate}%
      </div>
      
      {/* Chat Toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed bottom-6 right-6 z-50 p-4 rounded-full shadow-lg transition-all duration-300 animate-pulse",
          isOpen ? "bg-card border border-destructive" : "bg-primary/20 border border-primary/50 hover:bg-primary/30"
        )}
      >
        {isOpen ? <X size={24} /> : <MessageCircle size={24} />}
      </button>

      {/* Chat Panel */}
      <div
        className={cn(
          "fixed bottom-20 right-6 z-50 w-96 h-[500px] bg-card/95 backdrop-blur-md border border-border/50 rounded-xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300",
          isOpen ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
        )}
      >
        {/* Live Header */}
        <div className="p-4 border-b border-border/50 bg-gradient-to-r from-primary/10 to-secondary/10 flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-primary to-secondary rounded-lg">
            <Sparkles size={20} className="text-background animate-pulse" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-sm flex items-center gap-2">
              Live GNN-IDS Assistant
            </h3>
            <p className="text-xs text-muted-foreground">
              Real-time alerts: {alerts.length} | Anomaly: {networkStats.anomalyRate}%
            </p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {messages.map((message) => (
            <div key={message.id} className={cn("flex gap-3", message.role === "user" ? "flex-row-reverse" : "flex-row")}>
              <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0", message.role === "user" ? "bg-gradient-to-r from-blue-500 to-indigo-500" : "bg-gradient-to-br from-primary to-secondary")}>
                {message.role === "user" ? <User size={14} className="text-white" /> : <Bot size={14} className="text-background" />}
              </div>
              <div className={cn("max-w-[80%] rounded-2xl p-3 text-sm", message.role === "user" ? "bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border border-blue-500/20" : "bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/20")}>
                {message.content}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center animate-pulse">
                <Bot size={14} className="text-background" />
              </div>
              <div className="bg-primary/10 border border-primary/20 rounded-2xl p-3 flex items-center gap-2">
                <Loader2 size={16} className="text-primary animate-spin" />
                <span className="text-sm">Analyzing live data...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-border/50 bg-gradient-to-r from-muted/50 to-background/50">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder={`Live context: ${getLiveContext().slice(0, 60)}...`}
              className="flex-1 bg-secondary/50 border border-border/50 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground/70"
              disabled={isLoading}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="p-3 bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 text-background rounded-xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:scale-105"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default AIChatbot;


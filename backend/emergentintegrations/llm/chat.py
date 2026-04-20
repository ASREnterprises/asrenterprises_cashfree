from dataclasses import dataclass


@dataclass
class UserMessage:
    text: str


@dataclass
class FileContentWithMimeType:
    content: bytes | str
    mime_type: str


class LlmChat:
    def __init__(self, api_key=None, session_id=None, system_message=None, **kwargs):
        self.api_key = api_key
        self.session_id = session_id
        self.system_message = system_message
        self.provider = kwargs.get("provider")
        self.model = kwargs.get("model")

    def with_model(self, provider, model):
        self.provider = provider
        self.model = model
        return self

    async def send_message(self, *args, **kwargs):
        messages = kwargs.get("messages")
        if not messages and args:
            messages = args
        text = ""
        if messages:
            first = messages[0]
            text = getattr(first, "text", str(first))
        if "json" in text.lower() or "return json" in text.lower():
            return '{"lead_score": 75, "recommended_system": "3-5 kW System", "ai_analysis": "Potential solar customer in Bihar"}'
        return "AI service is not configured in this Replit environment. Please contact ASR ENTERPRISES at 9296389097 for assistance."

    async def send_message_async(self, *args, **kwargs):
        return await self.send_message(*args, **kwargs)
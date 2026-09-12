"""
Channel definitions and personality profiles for the Mock Social Media Platform.
"""

from typing import Dict, List
from pydantic import BaseModel


class ChannelProfile(BaseModel):
    name: str
    display_name: str
    description: str
    target_demographic: str
    preferred_tone: str
    optimal_copy_length: str
    optimal_timing: str
    cta_preference: str


CHANNELS: Dict[str, ChannelProfile] = {
    "short_form": ChannelProfile(
        name="short_form",
        display_name="QuickPulse",
        description="High-velocity visual feed focusing on snappy hooks, dynamic motion, and quick lifestyle takeaways.",
        target_demographic="Gen Z & Millennials, creators, outdoor adventurers, mobile-first users",
        preferred_tone="Punchy, energetic, informal, authentic",
        optimal_copy_length="Under 150 characters with bold first 3 words",
        optimal_timing="Evening window (17:00 - 21:00)",
        cta_preference="Casual link prompts or quick questions",
    ),
    "community_forum": ChannelProfile(
        name="community_forum",
        display_name="NexusForum",
        description="Threaded discussion platform where enthusiasts debate technical details, review gear, and share authentic stories.",
        target_demographic="Technical enthusiasts, gearheads, indie hardware backers, skeptical community members",
        preferred_tone="Transparent, thoughtful, humble, conversational",
        optimal_copy_length="200 - 500 characters providing context and asking a community question",
        optimal_timing="Afternoon and early evening (13:00 - 20:00)",
        cta_preference="Open-ended questions ending with a '?' that stimulate deep thread discussion",
    ),
    "professional": ChannelProfile(
        name="professional",
        display_name="ProSphere",
        description="B2B and leadership network focused on industry innovation, sustainability metrics, and thought leadership.",
        target_demographic="Founders, engineers, sustainability officers, B2B procurement, industry professionals",
        preferred_tone="Analytical, authoritative, data-backed, professional",
        optimal_copy_length="350 - 700 characters formatted into clean paragraphs",
        optimal_timing="Workday morning peak (08:00 - 11:30)",
        cta_preference="Value-based / research CTAs (e.g. 'Read our technical whitepaper', 'Share your perspective')",
    ),
}

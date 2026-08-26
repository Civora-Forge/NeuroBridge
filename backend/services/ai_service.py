import os
import json
import google.generativeai as genai
from typing import List, Dict, Any

# Configure Gemini
api_key = os.getenv("GEMINI_API_KEY")
if api_key:
    genai.configure(api_key=api_key)

def generate_exposure_suggestions(category: str) -> List[str]:
    """Generates a list of exposure tasks for a specific OCD category."""
    if not api_key:
        return [f"Sample exposure task for {category}"]
    
    model = genai.GenerativeModel("gemini-2.5-flash")
    prompt = f"You are an expert OCD ERP therapist. Generate a JSON list of 5 progressive exposure tasks (from easiest to hardest) for a patient with the OCD category: '{category}'. Return ONLY a JSON array of strings, nothing else."
    
    try:
        response = model.generate_content(prompt)
        text = response.text.strip()
        if text.startswith("```json"):
            text = text[7:-3]
        return json.loads(text)
    except Exception as e:
        print(f"Error generating exposure tasks: {e}")
        return ["Touch a doorknob", "Don't wash hands for 1 minute"]

def summarize_erp_session(pre_suds: int, post_suds: int, duration: int, resisted: bool, notes: str) -> str:
    """Provides an encouraging summary and insights for an ERP session."""
    if not api_key:
        return "Good job completing your ERP session!"
    
    model = genai.GenerativeModel("gemini-2.5-flash")
    prompt = f"""
    You are an encouraging OCD coach. Provide a brief, supportive 2-sentence summary of an ERP session:
    Pre-SUDS: {pre_suds}/100, Post-SUDS: {post_suds}/100.
    Duration: {duration} seconds.
    Resisted Compulsion: {resisted}.
    Notes: {notes}
    """
    try:
        response = model.generate_content(prompt)
        return response.text.strip()
    except Exception:
        return "You're making progress on your habituation."

def analyze_journal_entry(trigger: str, obsession: str, emotion: str, anxiety: int) -> str:
    """Analyzes a journal entry and suggests an ERP approach."""
    if not api_key:
        return "Track these triggers to find patterns."
    
    model = genai.GenerativeModel("gemini-2.5-flash")
    prompt = f"""
    You are an expert OCD coach. Analyze this journal entry:
    Trigger: {trigger}
    Obsession: {obsession}
    Emotion: {emotion}
    Anxiety: {anxiety}/100
    
    Provide a 2-sentence encouraging insight and suggest one small ERP exercise to help.
    """
    try:
        response = model.generate_content(prompt)
        return response.text.strip()
    except Exception:
        return "Consider practicing delayed response to this trigger."

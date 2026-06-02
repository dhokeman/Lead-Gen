require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');

let ai = null;
try {
  if (process.env.GEMINI_API_KEY) {
    ai = new GoogleGenAI();
  }
} catch (e) {
  console.warn("Could not init GoogleGenAI. Proceeding without AI.");
}

async function generateConnectionMessage(profileData, basePrompt) {
  try {
    const prompt = `
      You are an expert sales representative drafting a LinkedIn connection message.
      Your Goal / Base Prompt: ${basePrompt}
      
      Proxy Profile Information of the Lead:
      Name: ${profileData.name}
      Headline: ${profileData.headline}
      About: ${profileData.about}
      
      Draft a short, highly personalized connection request message.
      The message MUST be under 300 characters to fit LinkedIn's limit.
      Do not include any placeholders (like [Your Name]). Only return the final message text.
    `;
    
    if (!ai) {
      console.warn("AI instance not initialized (missing API key). Using fallback message.");
      return `Hi ${profileData.name.split(' ')[0]}, I'd love to connect and learn more about your work as a ${profileData.headline}!`;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    
    return response.text.trim();
  } catch (error) {
    console.error("AI Generation Error:", error.message);
    return `Hi ${profileData.name.split(' ')[0]}, I'd love to connect and learn more about your work as a ${profileData.headline}!`;
  }
}

async function classifyReplyIntent(replyText) {
  const prompt = `
    Classify the intent of the following reply from a LinkedIn prospect.
    Categories: 
    - Positive (They are interested, agreed to a meeting, or gave a good response)
    - Negative (They are not interested, told you to stop, or no thanks)
    - Question (They are asking for more information before deciding)
    
    Reply Text: "${replyText}"
    
    Return ONLY ONE WORD exact match from the categories above.
  `;
  try {
     const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    const text = response.text.trim();
    if (text.includes('Positive')) return 'Positive';
    if (text.includes('Negative')) return 'Negative';
    return 'Question';
  } catch(e) {
    return 'Question';
  }
}

module.exports = { generateConnectionMessage, classifyReplyIntent };

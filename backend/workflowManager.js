const db = require('./db');
const LinkedinBot = require('./linkedinBot');
const { generateConnectionMessage } = require('./aiAgent');

class WorkflowManager {
   constructor() {
     this.bot = new LinkedinBot();
     this.isRunning = false;
     this.interval = null;
   }
   
   async start() {
      if(this.isRunning) return;
      this.isRunning = true;
      console.log("Starting Workflow Engine...");
      await this.bot.init();
      
      // Basic polling loop every 10 seconds to process the next lead
      this.interval = setInterval(() => this.processNext(), 10000);
   }
   
   async stop() {
      console.log("Stopping Workflow Engine...");
      this.isRunning = false;
      if (this.interval) clearInterval(this.interval);
      await this.bot.close();
   }
   
   async processNext() {
      // Find one contact that is in 'Imported' state
      const contact = db.prepare("SELECT * FROM contacts WHERE state = 'Imported' LIMIT 1").get();
      if (!contact) {
        // Here we could add logic to move contacts forward in other states (e.g., checking replies)
        return;
      }
      
      console.log(`\n--- Processing contact: ${contact.profile_url} ---`);
      
      try {
          // Get campaign info
          const campaign = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(contact.campaign_id);
          
          // 1. Visit Profile (Update State)
          const profileData = await this.bot.visitProfile(contact.profile_url);
          db.prepare("UPDATE contacts SET state = 'Visited', name = ?, headline = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?")
            .run(profileData.name, profileData.headline, contact.id);
            
          
          // 2. Draft personal request using AI
          const msg = await generateConnectionMessage(profileData, campaign.base_prompt);
          
          // 3. Send Connection Request on LinkedIn
          await this.bot.sendConnectionRequest(contact.profile_url, msg);
          
          // Update DB State
          db.prepare("UPDATE contacts SET state = 'Request_Sent', ai_drafted_message = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?")
            .run(msg, contact.id);
            
          console.log(`Successfully completed sequence for ${profileData.name}`);
            
      } catch (error) {
          console.error(`Failed to process ${contact.profile_url}:`, error);
      }
   }
}

const manager = new WorkflowManager();
module.exports = manager;

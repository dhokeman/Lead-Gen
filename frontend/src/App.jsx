import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Play, Square, Users, Upload, LayoutList } from 'lucide-react';
import './index.css';

const API_URL = 'http://localhost:3001/api';

function App() {
  const [campaigns, setCampaigns] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState(null);
  const [newCampName, setNewCampName] = useState('');
  const [newCampPrompt, setNewCampPrompt] = useState('');
  const [urlsInput, setUrlsInput] = useState('');
  const [engineState, setEngineState] = useState('Stopped');

  useEffect(() => {
    fetchCampaigns();
  }, []);

  useEffect(() => {
    // Poll contacts if running
    let interval;
    if (selectedCampaignId && engineState === 'Running') {
      interval = setInterval(() => {
        fetchContacts(selectedCampaignId);
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [selectedCampaignId, engineState]);

  const fetchCampaigns = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/campaigns`);
      setCampaigns(data);
      if (data.length > 0 && !selectedCampaignId) {
        setSelectedCampaignId(data[0].id);
        fetchContacts(data[0].id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchContacts = async (campId) => {
    try {
      const { data } = await axios.get(`${API_URL}/contacts/${campId}`);
      setContacts(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateCampaign = async (e) => {
    e.preventDefault();
    try {
      const { data } = await axios.post(`${API_URL}/campaigns`, {
        name: newCampName,
        base_prompt: newCampPrompt
      });
      setNewCampName('');
      setNewCampPrompt('');
      fetchCampaigns();
      setSelectedCampaignId(data.id);
      fetchContacts(data.id);
    } catch (e) {
      console.error(e);
    }
  };

  const handleImport = async () => {
    if(!selectedCampaignId) return;
    const urls = urlsInput.split('\n').map(l => l.trim()).filter(Boolean);
    if(urls.length === 0) return;

    try {
      await axios.post(`${API_URL}/contacts/import`, {
        campaign_id: selectedCampaignId,
        profile_urls: urls
      });
      setUrlsInput('');
      fetchContacts(selectedCampaignId);
    } catch(e) {
       console.error(e);
    }
  };

  const startEngine = async () => {
    await axios.post(`${API_URL}/engine/start`);
    setEngineState('Running');
  }

  const stopEngine = async () => {
    await axios.post(`${API_URL}/engine/stop`);
    setEngineState('Stopped');
  }

  const activeCampaignInfo = campaigns.find(c => c.id === selectedCampaignId);

  return (
    <div className="app-container">
       <aside className="sidebar">
          <div className="brand">
              <div className="brand-logo"><Users /></div>
              <h2>LeadGen.AI</h2>
          </div>
          
          <nav className="menu">
             <div className="menu-group">
                <h3>CAMPAIGNS</h3>
                {campaigns.map(c => (
                  <button 
                    key={c.id} 
                    className={`menu-item ${c.id === selectedCampaignId ? 'active' : ''}`}
                    onClick={() => { setSelectedCampaignId(c.id); fetchContacts(c.id); }}
                  >
                    <LayoutList size={18}/>
                    {c.name}
                  </button>
                ))}
             </div>
          </nav>

          <div className="new-campaign-card">
              <h4>Create Campaign</h4>
              <form onSubmit={handleCreateCampaign}>
                 <input 
                    placeholder="Campaign Name" 
                    required 
                    value={newCampName}
                    onChange={e => setNewCampName(e.target.value)}
                 />
                 <textarea 
                    placeholder="Base AI Prompt (e.g. Pitch a React role...)"
                    required
                    value={newCampPrompt}
                    onChange={e => setNewCampPrompt(e.target.value)}
                 />
                 <button type="submit" className="btn-primary">Create</button>
              </form>
          </div>
       </aside>

       <main className="main-content">
          <header className="topbar">
             <div>
                <h1 className="page-title">{activeCampaignInfo ? activeCampaignInfo.name : 'Dashboard'}</h1>
                <p className="page-subtitle">Agent Status: <span className={`status-badge ${engineState.toLowerCase()}`}>{engineState}</span></p>
             </div>
             <div className="actions">
                {engineState === 'Stopped' ? (
                  <button className="btn-success" onClick={startEngine}><Play size={18}/> Start Agent</button>
                ) : (
                  <button className="btn-danger" onClick={stopEngine}><Square size={18}/> Stop Agent</button>
                )}
             </div>
          </header>

          {selectedCampaignId ? (
            <div className="content-grid">
               <div className="panel import-panel">
                  <div className="panel-header">
                     <h3><Upload size={20}/> Import Leads</h3>
                  </div>
                  <div className="panel-body">
                     <p className="instructions">Paste LinkedIn profile URLs (one per line):</p>
                     <textarea 
                        className="url-input"
                        value={urlsInput}
                        onChange={e => setUrlsInput(e.target.value)}
                        placeholder={"https://linkedin.com/in/johndoe\nhttps://linkedin.com/in/janedoe"}
                     />
                     <button className="btn-primary full-width" onClick={handleImport}>Import</button>
                  </div>
               </div>

               <div className="panel data-panel">
                  <div className="panel-header">
                     <h3>Pipeline ({contacts.length} total)</h3>
                  </div>
                  <div className="table-responsive">
                     <table className="data-table">
                        <thead>
                           <tr>
                              <th>Lead</th>
                              <th>Status</th>
                              <th>AI Message Draft</th>
                           </tr>
                        </thead>
                        <tbody>
                           {contacts.map(c => (
                              <tr key={c.id}>
                                 <td>
                                    <div className="lead-info">
                                        <span className="lead-name">{c.name || 'Unknown'}</span>
                                        <span className="lead-url">{c.profile_url}</span>
                                    </div>
                                 </td>
                                 <td>
                                    <span className={`state-badge state-${c.state.toLowerCase()}`}>{c.state}</span>
                                 </td>
                                 <td className="message-cell">{c.ai_drafted_message ? c.ai_drafted_message : <span className="muted">Waiting for agent...</span>}</td>
                              </tr>
                           ))}
                           {contacts.length === 0 && (
                             <tr><td colSpan="3" align="center" className="empty-state">No leads imported yet.</td></tr>
                           )}
                        </tbody>
                     </table>
                  </div>
               </div>
            </div>
          ) : (
             <div className="welcome-state">
                <h2>Welcome to Agentic Lead Gen</h2>
                <p>Create a campaign on the left to get started building your pipeline.</p>
             </div>
          )}
       </main>
    </div>
  );
}

export default App;

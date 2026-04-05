import { useState, useEffect, useCallback } from "react";
import axios from "axios";

const API = `http://${window.location.hostname}`;

function App() {
  const [players, setPlayers] = useState([]);
  const [matches, setMatches] = useState([]);
  const [tab, setTab] = useState("leaderboard");
  const [newPlayer, setNewPlayer] = useState({ username: "", elo: 1200 });
  const [newMatch, setNewMatch] = useState({ player1Id: "", player2Id: "" });
  const [winnerId, setWinnerId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fetchPlayers = useCallback(async () => {
    const res = await axios.get(`${API}/api/players`);
    setPlayers(res.data);
  }, []);

  const fetchMatches = useCallback(async () => {
    const res = await axios.get(`${API}/api/matches`);
    setMatches(res.data);
  }, []);

  useEffect(() => {
    fetchPlayers();
    fetchMatches();
    const interval = setInterval(() => { fetchPlayers(); fetchMatches(); }, 10000);
    return () => clearInterval(interval);
  }, [fetchPlayers, fetchMatches]);

  const notify = (msg, isError = false) => {
    isError ? setError(msg) : setSuccess(msg);
    setTimeout(() => { setError(""); setSuccess(""); }, 3000);
  };

  const createPlayer = async () => {
    if (!newPlayer.username) return notify("Username requis", true);
    try {
      await axios.post(`${API}/api/players`, newPlayer);
      setNewPlayer({ username: "", elo: 1200 });
      fetchPlayers();
      notify("Joueur créé !");
    } catch (e) {
      notify(e.response?.data?.error || "Erreur", true);
    }
  };

  const createMatch = async () => {
    if (!newMatch.player1Id || !newMatch.player2Id) return notify("Sélectionnez 2 joueurs", true);
    if (newMatch.player1Id === newMatch.player2Id) return notify("Joueurs différents requis", true);
    try {
      await axios.post(`${API}/api/matches`, {
        player1Id: parseInt(newMatch.player1Id),
        player2Id: parseInt(newMatch.player2Id)
      });
      setNewMatch({ player1Id: "", player2Id: "" });
      fetchMatches();
      notify("Partie créée !");
    } catch (e) {
      notify(e.response?.data?.error || "Erreur", true);
    }
  };

  const submitResult = async (matchId) => {
    if (!winnerId) return notify("Sélectionnez un gagnant", true);
    try {
      await axios.put(`${API}/api/matches/${matchId}/result`, { winnerId: parseInt(winnerId) });
      setWinnerId("");
      fetchMatches();
      fetchPlayers();
      notify("Résultat enregistré !");
    } catch (e) {
      notify(e.response?.data?.error || "Erreur", true);
    }
  };

  const pending = matches.filter(m => m.status === "pending");
  const finished = matches.filter(m => m.status === "finished");

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <span style={styles.logo}>♟</span>
        <h1 style={styles.title}>Chess Tournament</h1>
        <span style={styles.badge}>{players.length} joueurs</span>
      </header>

      {error && <div style={styles.alertError}>{error}</div>}
      {success && <div style={styles.alertSuccess}>{success}</div>}

      <nav style={styles.nav}>
        {["leaderboard", "matches", "create"].map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={tab === t ? {...styles.navBtn, ...styles.navBtnActive} : styles.navBtn}>
            {t === "leaderboard" ? "Classement" : t === "matches" ? "Parties" : "Nouveau"}
          </button>
        ))}
      </nav>

      <main style={styles.main}>
        {tab === "leaderboard" && (
          <div>
            <h2 style={styles.sectionTitle}>Classement ELO</h2>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>#</th>
                  <th style={styles.th}>Joueur</th>
                  <th style={styles.th}>ELO</th>
                  <th style={styles.th}>Parties</th>
                </tr>
              </thead>
              <tbody>
                {players.map((p, i) => (
                  <tr key={p.id} style={i % 2 === 0 ? styles.trEven : styles.trOdd}>
                    <td style={styles.td}>
                      <span style={i < 3 ? {...styles.rank, background: ["#FFD700","#C0C0C0","#CD7F32"][i]} : styles.rankGray}>
                        {i + 1}
                      </span>
                    </td>
                    <td style={styles.td}><strong>{p.username}</strong></td>
                    <td style={styles.td}>
                      <span style={styles.elo}>{p.elo}</span>
                    </td>
                    <td style={styles.td}>
                      {finished.filter(m => m.player1_id === p.id || m.player2_id === p.id).length}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "matches" && (
          <div>
            {pending.length > 0 && (
              <div>
                <h2 style={styles.sectionTitle}>Parties en cours</h2>
                {pending.map(m => (
                  <div key={m.id} style={styles.matchCard}>
                    <div style={styles.matchPlayers}>
                      <span style={styles.playerName}>{m.player1_username}</span>
                      <span style={styles.vs}>vs</span>
                      <span style={styles.playerName}>{m.player2_username}</span>
                    </div>
                    <div style={styles.resultRow}>
                      <select value={winnerId} onChange={e => setWinnerId(e.target.value)} style={styles.select}>
                        <option value="">Gagnant...</option>
                        <option value={m.player1_id}>{m.player1_username}</option>
                        <option value={m.player2_id}>{m.player2_username}</option>
                      </select>
                      <button onClick={() => submitResult(m.id)} style={styles.btnPrimary}>
                        Valider
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <h2 style={styles.sectionTitle}>Historique</h2>
            {finished.length === 0 && <p style={styles.empty}>Aucune partie terminée</p>}
            {finished.map(m => {
              const winnerName = m.winner_id === m.player1_id ? m.player1_username : m.player2_username;
              return (
                <div key={m.id} style={styles.matchCardFinished}>
                  <div style={styles.matchPlayers}>
                    <span style={styles.playerName}>{m.player1_username}</span>
                    <span style={styles.vs}>vs</span>
                    <span style={styles.playerName}>{m.player2_username}</span>
                  </div>
                  <div style={styles.matchMeta}>
                    <span style={styles.winner}>Gagnant : {winnerName}</span>
                    <span style={styles.eloChange}>
                      ELO : {m.player1_elo_before}→{m.player1_elo_after} / {m.player2_elo_before}→{m.player2_elo_after}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === "create" && (
          <div>
            <h2 style={styles.sectionTitle}>Nouveau joueur</h2>
            <div style={styles.form}>
              <input placeholder="Username" value={newPlayer.username}
                onChange={e => setNewPlayer({...newPlayer, username: e.target.value})}
                style={styles.input} />
              <input type="number" placeholder="ELO de départ" value={newPlayer.elo}
                onChange={e => setNewPlayer({...newPlayer, elo: parseInt(e.target.value)})}
                style={styles.input} />
              <button onClick={createPlayer} style={styles.btnPrimary}>Créer le joueur</button>
            </div>

            <h2 style={{...styles.sectionTitle, marginTop: "2rem"}}>Nouvelle partie</h2>
            <div style={styles.form}>
              <select value={newMatch.player1Id}
                onChange={e => setNewMatch({...newMatch, player1Id: e.target.value})}
                style={styles.select}>
                <option value="">Joueur 1...</option>
                {players.map(p => <option key={p.id} value={p.id}>{p.username} ({p.elo})</option>)}
              </select>
              <select value={newMatch.player2Id}
                onChange={e => setNewMatch({...newMatch, player2Id: e.target.value})}
                style={styles.select}>
                <option value="">Joueur 2...</option>
                {players.map(p => <option key={p.id} value={p.id}>{p.username} ({p.elo})</option>)}
              </select>
              <button onClick={createMatch} style={styles.btnPrimary}>Lancer la partie</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

const styles = {
  app: { minHeight: "100vh", background: "#0f1117", color: "#e8e8e8", fontFamily: "system-ui, sans-serif" },
  header: { display: "flex", alignItems: "center", gap: "12px", padding: "20px 32px", borderBottom: "1px solid #2a2a3a", background: "#16171f" },
  logo: { fontSize: "32px" },
  title: { margin: 0, fontSize: "22px", fontWeight: 600, color: "#fff", flex: 1 },
  badge: { background: "#2a2a3a", padding: "4px 12px", borderRadius: "20px", fontSize: "13px", color: "#888" },
  alertError: { margin: "12px 32px", padding: "10px 16px", background: "#3a1a1a", border: "1px solid #7f2020", borderRadius: "8px", color: "#f08080" },
  alertSuccess: { margin: "12px 32px", padding: "10px 16px", background: "#1a3a1a", border: "1px solid #207f20", borderRadius: "8px", color: "#80f080" },
  nav: { display: "flex", gap: "4px", padding: "16px 32px", background: "#16171f" },
  navBtn: { padding: "8px 20px", border: "1px solid #2a2a3a", borderRadius: "8px", background: "transparent", color: "#888", cursor: "pointer", fontSize: "14px" },
  navBtnActive: { background: "#5865f2", borderColor: "#5865f2", color: "#fff" },
  main: { padding: "24px 32px", maxWidth: "860px" },
  sectionTitle: { fontSize: "16px", fontWeight: 600, color: "#ccc", marginBottom: "16px", marginTop: 0 },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { textAlign: "left", padding: "10px 14px", fontSize: "12px", color: "#666", borderBottom: "1px solid #2a2a3a", fontWeight: 500 },
  td: { padding: "12px 14px", fontSize: "14px" },
  trEven: { background: "#16171f" },
  trOdd: { background: "#1a1b24" },
  rank: { display: "inline-block", width: "24px", height: "24px", borderRadius: "50%", textAlign: "center", lineHeight: "24px", fontSize: "12px", fontWeight: 700, color: "#111" },
  rankGray: { display: "inline-block", width: "24px", height: "24px", borderRadius: "50%", textAlign: "center", lineHeight: "24px", fontSize: "12px", color: "#666", background: "#2a2a3a" },
  elo: { background: "#1e3a5f", color: "#60a5fa", padding: "2px 10px", borderRadius: "12px", fontSize: "13px", fontWeight: 600 },
  matchCard: { background: "#16171f", border: "1px solid #2a2a3a", borderRadius: "10px", padding: "16px", marginBottom: "12px" },
  matchCardFinished: { background: "#16171f", border: "1px solid #2a2a3a", borderRadius: "10px", padding: "16px", marginBottom: "12px", opacity: 0.8 },
  matchPlayers: { display: "flex", alignItems: "center", gap: "16px", marginBottom: "12px" },
  playerName: { fontWeight: 600, fontSize: "15px" },
  vs: { color: "#555", fontSize: "12px", fontWeight: 700 },
  resultRow: { display: "flex", gap: "10px", alignItems: "center" },
  matchMeta: { display: "flex", flexDirection: "column", gap: "4px" },
  winner: { fontSize: "13px", color: "#80f080" },
  eloChange: { fontSize: "12px", color: "#666" },
  form: { display: "flex", flexDirection: "column", gap: "12px", maxWidth: "400px" },
  input: { padding: "10px 14px", background: "#1a1b24", border: "1px solid #2a2a3a", borderRadius: "8px", color: "#e8e8e8", fontSize: "14px" },
  select: { padding: "10px 14px", background: "#1a1b24", border: "1px solid #2a2a3a", borderRadius: "8px", color: "#e8e8e8", fontSize: "14px" },
  btnPrimary: { padding: "10px 20px", background: "#5865f2", border: "none", borderRadius: "8px", color: "#fff", fontSize: "14px", fontWeight: 600, cursor: "pointer" },
  empty: { color: "#555", fontSize: "14px" },
};

export default App;
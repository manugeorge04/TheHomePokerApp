import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Avatar from '@mui/material/Avatar';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import AddIcon from '@mui/icons-material/Add';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ShareIcon from '@mui/icons-material/Share';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import StopIcon from '@mui/icons-material/Stop';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import ShieldIcon from '@mui/icons-material/Shield';
import AddModeratorIcon from '@mui/icons-material/AddModerator';
import RemoveModeratorIcon from '@mui/icons-material/RemoveModerator';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import type { Session, SessionPlayer } from '../types';

interface PlayerWithBuyins extends SessionPlayer {
  buyins: number;
  rebuyCount: number;
}

export default function SessionLobbyPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [players, setPlayers] = useState<PlayerWithBuyins[]>([]);
  const [isHost, setIsHost] = useState(false);
  const [isHostOrCohost, setIsHostOrCohost] = useState(false);
  const [copySnack, setCopySnack] = useState(false);
  const [rebuyOpen, setRebuyOpen] = useState(false);
  const [addPlayerOpen, setAddPlayerOpen] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerWithBuyins | null>(null);
  const [rebuyAmount, setRebuyAmount] = useState(String(profile?.preferred_buyin ?? 20));
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerBuyin, setNewPlayerBuyin] = useState('20');
  const [endConfirmOpen, setEndConfirmOpen] = useState(false);
  const [editSessionOpen, setEditSessionOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [kickConfirmOpen, setKickConfirmOpen] = useState(false);
  const [playerToKick, setPlayerToKick] = useState<PlayerWithBuyins | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const loadSession = useCallback(async () => {
    if (!sessionId) return;
    const { data: s } = await supabase.from('sessions').select('*').eq('id', sessionId).single();
    if (!s) return;
    setSession(s as Session);
    const host = s.host_id === user?.id;
    setIsHost(host);

    const { data: playerRows } = await supabase
      .from('session_players')
      .select('*')
      .eq('session_id', sessionId)
      .order('joined_at');

    const { data: buyinRows } = await supabase
      .from('buy_ins')
      .select('*')
      .eq('session_id', sessionId);

    const enriched: PlayerWithBuyins[] = (playerRows ?? []).map((p) => {
      const pBuyins = (buyinRows ?? []).filter((b) => b.session_player_id === p.id);
      return {
        ...p,
        buyins: pBuyins.length > 0
          ? pBuyins.reduce((sum: number, b) => sum + Number(b.amount), 0)
          : Number(p.total_buyin || 0),
        rebuyCount: pBuyins.filter((b) => b.is_rebuy).length,
      };
    });
    setPlayers(enriched);

    // Check if current user is host or co-host
    const currentPlayer = enriched.find((p) => p.user_id === user?.id);
    setIsHostOrCohost(host || (currentPlayer?.is_cohost ?? false));
  }, [sessionId, user?.id]);

  useEffect(() => {
    loadSession();

    const channel = supabase
      .channel(`session:${sessionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'session_players', filter: `session_id=eq.${sessionId}` }, loadSession)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'buy_ins', filter: `session_id=eq.${sessionId}` }, loadSession)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions', filter: `id=eq.${sessionId}` }, loadSession)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [loadSession, sessionId]);

  // Redirect if session closed
  useEffect(() => {
    if (session?.status === 'closed') {
      navigate(`/session/${sessionId}/summary`);
    }
  }, [session, sessionId, navigate]);

  const totalBuyins = players.reduce((sum, p) => sum + Number(p.buyins), 0);

  async function handleEditSession() {
    if (!sessionId || !editTitle.trim()) return;
    setLoading(true);
    try {
      await supabase.from('sessions').update({ title: editTitle.trim() }).eq('id', sessionId);
      
      // Update state instantly
      setSession(prev => prev ? { ...prev, title: editTitle.trim() } : null);
      setEditSessionOpen(false);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteSession() {
    if (!sessionId) return;
    setLoading(true);
    try {
      await supabase.from('sessions').delete().eq('id', sessionId);
      navigate('/');
    } finally {
      setLoading(false);
    }
  }

  async function handleShare() {
    if (!session) return;
    const shareUrl = `${window.location.origin}/?join=${session.join_code}`;
    const shareData = {
      title: session.title || 'Poker Session',
      text: `Join my poker session "${session.title}"! Tap the link to jump in.`,
      url: shareUrl,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(shareUrl);
        setCopySnack(true);
      }
    } catch {
      // user cancelled share — no action needed
    }
  }

  async function handleRebuy() {
    if (!selectedPlayer || !sessionId) return;
    setLoading(true);
    try {
      const amount = parseFloat(rebuyAmount) || 0;
      await supabase.from('buy_ins').insert({
        session_id: sessionId,
        session_player_id: selectedPlayer.id,
        amount,
        is_rebuy: true,
      });

      // Re-fetch sum from buy_ins to avoid race condition with stale total_buyin
      const { data: allBuyins } = await supabase
        .from('buy_ins')
        .select('amount')
        .eq('session_player_id', selectedPlayer.id);
      const newTotal = (allBuyins ?? []).reduce((sum, b) => sum + Number(b.amount), 0);

      await supabase
        .from('session_players')
        .update({ total_buyin: newTotal })
        .eq('id', selectedPlayer.id);

      setRebuyOpen(false);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddPlayer() {
    if (!sessionId) return;
    setError('');
    setLoading(true);
    try {
      const amount = parseFloat(newPlayerBuyin) || 0;
      const { data: player, error: err } = await supabase
        .from('session_players')
        .insert({ session_id: sessionId, display_name: newPlayerName, total_buyin: amount })
        .select()
        .single();
      if (err) throw err;
      if (amount > 0) {
        await supabase.from('buy_ins').insert({
          session_id: sessionId,
          session_player_id: player.id,
          amount,
          is_rebuy: false,
        });
      }

      // Append new player to state instantly
      const newPlayerFormatted: PlayerWithBuyins = {
        ...player,
        buyins: amount,
        rebuyCount: 0
      };
      setPlayers(prev => [...prev, newPlayerFormatted]);

      setAddPlayerOpen(false);
      setNewPlayerName('');
      setNewPlayerBuyin('20');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add player');
    } finally {
      setLoading(false);
    }
  }

  async function handleEndSession() {
    if (!sessionId) return;
    await supabase.from('sessions').update({ status: 'closed', ended_at: new Date().toISOString() }).eq('id', sessionId);
    setEndConfirmOpen(false);
    navigate(`/session/${sessionId}/summary`);
  }

  async function handleKickPlayer() {
    if (!playerToKick) return;
    setLoading(true);
    try {
      await supabase.from('session_players').delete().eq('id', playerToKick.id);
      setKickConfirmOpen(false);
      setPlayerToKick(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleCohost(player: PlayerWithBuyins) {
    if (!isHost) return;
    setLoading(true);
    try {
      await supabase
        .from('session_players')
        .update({ is_cohost: !player.is_cohost })
        .eq('id', player.id);

      // Update local state
      setPlayers((prev) => prev.map((p) =>
        p.id === player.id ? { ...p, is_cohost: !p.is_cohost } : p
      ));
    } finally {
      setLoading(false);
    }
  }

  if (!session) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <Typography color="text.secondary">Loading session...</Typography>
    </Box>
  );

  return (
    <Box sx={{ pb: 10 }}>
      <AppBar position="sticky" sx={{ bgcolor: 'background.paper', borderBottom: '1px solid', borderColor: 'divider' }} elevation={0}>
        <Toolbar>
          <IconButton edge="start" onClick={() => navigate('/')} sx={{ mr: 1 }}>
            <ArrowBackIcon />
          </IconButton>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" fontWeight={700}>{session.title}</Typography>
            <Typography variant="caption" color="text.secondary">
              Active Session
            </Typography>
          </Box>
          {(isHost || isHostOrCohost) && (
            <Box sx={{ display: 'flex', gap: 1 }}>
              {isHost && (
                <IconButton
                  size="small"
                  onClick={() => { setEditTitle(session.title); setEditSessionOpen(true); }}
                  title="Edit session"
                >
                  <EditIcon fontSize="small" />
                </IconButton>
              )}
              {isHost && (
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => setDeleteConfirmOpen(true)}
                  title="Delete session"
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              )}
              <Button
                variant="outlined"
                color="error"
                size="small"
                startIcon={<StopIcon />}
                onClick={() => setEndConfirmOpen(true)}
              >
                End
              </Button>
            </Box>
          )}
        </Toolbar>
      </AppBar>

      <Box sx={{ px: 2, pt: 2, maxWidth: 600, mx: 'auto' }}>
        {/* Join Code Card */}
        <Card sx={{ mb: 2, background: 'linear-gradient(135deg, rgba(251,191,36,0.1), rgba(217,119,6,0.08))', border: '1px solid rgba(251,191,36,0.2)' }}>
          <CardContent sx={{ py: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography variant="caption" color="secondary.light" fontWeight={700}>JOIN CODE</Typography>
                <Typography variant="h4" fontWeight={800} sx={{ color: 'secondary.main', letterSpacing: 6 }}>
                  {session.join_code}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                <IconButton
                  onClick={() => {
                    navigator.clipboard.writeText(session.join_code);
                    setCopySnack(true);
                  }}
                  sx={{ color: 'secondary.main' }}
                >
                  <ContentCopyIcon />
                </IconButton>
                <IconButton
                  onClick={handleShare}
                  sx={{ color: 'secondary.main' }}
                >
                  <ShareIcon />
                </IconButton>
              </Box>
            </Box>
          </CardContent>
        </Card>

        {/* Total Card */}
        <Card sx={{ mb: 2 }}>
          <CardContent sx={{ py: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                <Typography variant="caption" color="text.secondary">Total Buy-Ins</Typography>
                <Typography variant="h5" fontWeight={800} sx={{ color: 'primary.main' }}>
                  ${totalBuyins.toFixed(0)}
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="caption" color="text.secondary">Players</Typography>
                <Typography variant="h5" fontWeight={800}>{players.length}</Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>

        {/* Players */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
          <Typography variant="subtitle1" fontWeight={700}>Players</Typography>
          {isHostOrCohost && (
            <Button size="small" startIcon={<PersonAddIcon />} onClick={() => setAddPlayerOpen(true)}>
              Add Player
            </Button>
          )}
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 3 }}>
          {players.map((player) => (
            <Card key={player.id}>
              <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Avatar sx={{ bgcolor: 'primary.dark', width: 36, height: 36, fontSize: '0.875rem', fontWeight: 700 }}>
                      {player.display_name[0].toUpperCase()}
                    </Avatar>
                    <Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" fontWeight={700}>{player.display_name}</Typography>
                        {player.user_id === session.host_id && (
                          <Chip label="Host" size="small" color="secondary" sx={{ height: 18, fontSize: '0.6rem' }} />
                        )}
                        {player.is_cohost && player.user_id !== session.host_id && (
                          <Chip icon={<ShieldIcon sx={{ fontSize: '0.8rem !important' }} />} label="Co-Host" size="small" color="primary" variant="outlined" sx={{ height: 18, fontSize: '0.6rem' }} />
                        )}
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        In: ${Number(player.buyins).toFixed(0)}
                        {player.rebuyCount > 0 && ` · ${player.rebuyCount} rebuy${player.rebuyCount > 1 ? 's' : ''}`}
                      </Typography>
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <IconButton
                      size="small"
                      sx={{ color: 'primary.main' }}
                      onClick={() => { setSelectedPlayer(player); setRebuyAmount(String(profile?.preferred_buyin ?? 20)); setRebuyOpen(true); }}
                      title="Add Rebuy"
                    >
                      <AddIcon fontSize="small" />
                    </IconButton>
                    {isHost && player.user_id !== session.host_id && (
                      <IconButton
                        size="small"
                        sx={{ color: player.is_cohost ? 'primary.main' : 'text.secondary', '&:hover': { color: 'primary.main' } }}
                        onClick={() => handleToggleCohost(player)}
                        title={player.is_cohost ? 'Remove co-host' : 'Make co-host'}
                      >
                        {player.is_cohost ? <RemoveModeratorIcon fontSize="small" /> : <AddModeratorIcon fontSize="small" />}
                      </IconButton>
                    )}
                    {isHostOrCohost && player.user_id !== session.host_id && (
                      <IconButton
                        size="small"
                        sx={{ color: 'error.main', opacity: 0.6, '&:hover': { opacity: 1 } }}
                        onClick={() => { setPlayerToKick(player); setKickConfirmOpen(true); }}
                        title="Remove player"
                      >
                        <PersonRemoveIcon fontSize="small" />
                      </IconButton>
                    )}
                  </Box>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>

        {/* Cash Out Button */}
        {players.some((p) => p.user_id === user?.id) && (
          <Button
            variant="contained"
            color="secondary"
            fullWidth
            size="large"
            startIcon={<AttachMoneyIcon />}
            onClick={() => navigate(`/session/${sessionId}/cashout`)}
            sx={{ py: 1.8, fontSize: '1rem' }}
          >
            Enter Cash-Out
          </Button>
        )}
      </Box>

      {/* Rebuy Dialog */}
      <Dialog open={rebuyOpen} onClose={() => setRebuyOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle fontWeight={700}>Add Rebuy — {selectedPlayer?.display_name}</DialogTitle>
        <DialogContent>
          <TextField
            label="Rebuy Amount ($)"
            type="number"
            value={rebuyAmount}
            onChange={(e) => setRebuyAmount(e.target.value)}
            fullWidth
            sx={{ mt: 1 }}
            inputProps={{ min: 1, step: 5 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setRebuyOpen(false)} color="inherit">Cancel</Button>
          <Button variant="contained" onClick={handleRebuy} disabled={loading}>Add Rebuy</Button>
        </DialogActions>
      </Dialog>

      {/* Add Player Dialog */}
      <Dialog open={addPlayerOpen} onClose={() => setAddPlayerOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle fontWeight={700}>Add Player</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Player Name"
              value={newPlayerName}
              onChange={(e) => setNewPlayerName(e.target.value)}
              fullWidth
            />
            <TextField
              label="Buy-In Amount ($)"
              type="number"
              value={newPlayerBuyin}
              onChange={(e) => setNewPlayerBuyin(e.target.value)}
              fullWidth
              inputProps={{ min: 0, step: 5 }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setAddPlayerOpen(false)} color="inherit">Cancel</Button>
          <Button variant="contained" onClick={handleAddPlayer} disabled={loading || !newPlayerName}>Add</Button>
        </DialogActions>
      </Dialog>

      {/* End Session Confirm */}
      <Dialog open={endConfirmOpen} onClose={() => setEndConfirmOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle fontWeight={700}>End Session?</DialogTitle>
        <DialogContent>
          <Typography>All players will be directed to enter their cash-out amounts.</Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEndConfirmOpen(false)} color="inherit">Cancel</Button>
          <Button variant="contained" color="error" onClick={handleEndSession}>End Session</Button>
        </DialogActions>
      </Dialog>

      {/* Edit Session Dialog */}
      <Dialog open={editSessionOpen} onClose={() => setEditSessionOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle fontWeight={700}>Edit Session</DialogTitle>
        <DialogContent>
          <TextField
            label="Session Title"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            fullWidth
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEditSessionOpen(false)} color="inherit">Cancel</Button>
          <Button variant="contained" onClick={handleEditSession} disabled={loading || !editTitle.trim()}>Save</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Session Confirm */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle fontWeight={700}>Delete Session?</DialogTitle>
        <DialogContent>
          <Typography color="error" sx={{ fontWeight: 600, mb: 1 }}>Warning: This will permanently delete the session and all associated data.</Typography>
          <Typography variant="body2" color="text.secondary">This includes all buy-ins, cash-outs, and player records.</Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteConfirmOpen(false)} color="inherit">Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDeleteSession} disabled={loading}>Delete Session</Button>
        </DialogActions>
      </Dialog>

      {/* Kick Player Confirm */}
      <Dialog open={kickConfirmOpen} onClose={() => setKickConfirmOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle fontWeight={700}>Remove Player?</DialogTitle>
        <DialogContent>
          <Typography>
            Remove <strong>{playerToKick?.display_name}</strong> from the session? Their buy-in records will also be deleted.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setKickConfirmOpen(false)} color="inherit">Cancel</Button>
          <Button variant="contained" color="error" onClick={handleKickPlayer} disabled={loading}>Remove</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={copySnack}
        autoHideDuration={2000}
        onClose={() => setCopySnack(false)}
        message="Copied to clipboard!"
      />
    </Box>
  );
}
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActionArea from '@mui/material/CardActionArea';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Avatar from '@mui/material/Avatar';
import AddIcon from '@mui/icons-material/Add';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import CasinoIcon from '@mui/icons-material/Casino';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import Alert from '@mui/material/Alert';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import type { Session } from '../types';

function formatMoney(val: number) {
  const abs = Math.abs(val);
  const formatted = abs % 1 === 0 ? `$${abs}` : `$${abs.toFixed(2)}`;
  return val >= 0 ? `+${formatted}` : `-${formatted}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function generateJoinCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

interface RecentSession extends Session {
  player_count: number;
  my_result?: number;
}

export default function DashboardPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([]);
  const [myStats, setMyStats] = useState({ net: 0, sessions: 0, winRate: 0 });
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [sessionTitle, setSessionTitle] = useState('Poker Night');
  const [createBuyin, setCreateBuyin] = useState(String(profile?.preferred_buyin ?? 20));
  const [joinCode, setJoinCode] = useState('');
  const [joinName, setJoinName] = useState('');
  const [joinBuyin, setJoinBuyin] = useState(String(profile?.preferred_buyin ?? 20));
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    setJoinName(profile?.display_name ?? '');
    setJoinBuyin(String(profile?.preferred_buyin ?? 20));
    setCreateBuyin(String(profile?.preferred_buyin ?? 20));
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile]);

  async function loadDashboard() {
    if (!user) return;

    // Find active session the user is part of
    const { data: playerRows } = await supabase
      .from('session_players')
      .select('session_id')
      .eq('user_id', user.id);

    const sessionIds = (playerRows ?? []).map((r) => r.session_id as string);

    if (sessionIds.length > 0) {
      const { data: activeSessions } = await supabase
        .from('sessions')
        .select('*')
        .eq('status', 'active')
        .in('id', sessionIds)
        .order('created_at', { ascending: false })
        .limit(1);
      setActiveSession(activeSessions?.[0] ?? null);

      const { data: closed } = await supabase
        .from('sessions')
        .select('*')
        .eq('status', 'closed')
        .in('id', sessionIds)
        .order('ended_at', { ascending: false })
        .limit(5);

      const sessionsWithMeta: RecentSession[] = [];
      for (const s of closed ?? []) {
        const { count } = await supabase
          .from('session_players')
          .select('*', { count: 'exact', head: true })
          .eq('session_id', s.id);
        const { data: myPlayer } = await supabase
          .from('session_players')
          .select('result')
          .eq('session_id', s.id)
          .eq('user_id', user.id)
          .single();
        sessionsWithMeta.push({ ...s, player_count: count ?? 0, my_result: myPlayer?.result });
      }
      setRecentSessions(sessionsWithMeta);

      // Stats
      const { data: myPlayers } = await supabase
        .from('session_players')
        .select('result')
        .eq('user_id', user.id)
        .not('result', 'is', null);
      const results = (myPlayers ?? []).map((p) => p.result as number);
      const net = results.reduce((a, b) => a + b, 0);
      const wins = results.filter((r) => r > 0).length;
      setMyStats({ net, sessions: results.length, winRate: results.length > 0 ? (wins / results.length) * 100 : 0 });
    }
  }

  async function handleCreateSession() {
    if (!user) return;
    setError('');
    setLoading(true);
    try {
      const code = generateJoinCode();
      const hostBuyinAmount = parseFloat(createBuyin) || 0;

      const { data: session, error: err } = await supabase
        .from('sessions')
        .insert({ join_code: code, host_id: user.id, title: sessionTitle || 'Poker Night' })
        .select()
        .single();
      if (err) throw err;

      // Add host as a player
      const { data: player, error: playerErr } = await supabase
        .from('session_players')
        .insert({
          session_id: session.id,
          user_id: user.id,
          display_name: profile?.display_name ?? 'Host',
          total_buyin: hostBuyinAmount,
        })
        .select()
        .single();
      if (playerErr) throw playerErr;

      if (hostBuyinAmount > 0) {
        const { error: buyinErr } = await supabase.from('buy_ins').insert({
          session_id: session.id,
          session_player_id: player.id,
          amount: hostBuyinAmount,
          is_rebuy: false,
        });
        if (buyinErr) throw buyinErr;
      }

      setCreateOpen(false);
      navigate(`/session/${session.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create session');
    } finally {
      setLoading(false);
    }
  }

  async function handleJoinSession() {
    if (!user) return;
    setError('');
    setLoading(true);
    try {
      const code = joinCode.toUpperCase().trim();
      const { data: session, error: err } = await supabase
        .from('sessions')
        .select('*')
        .eq('join_code', code)
        .eq('status', 'active')
        .single();
      if (err || !session) throw new Error('Session not found. Check the join code.');

      // Check if already joined
      const { data: existing } = await supabase
        .from('session_players')
        .select('id')
        .eq('session_id', session.id)
        .eq('user_id', user.id)
        .single();

      if (existing) {
        navigate(`/session/${session.id}`);
        return;
      }

      const buyinAmount = parseFloat(joinBuyin) || 0;
      const { data: player, error: playerErr } = await supabase
        .from('session_players')
        .insert({
          session_id: session.id,
          user_id: user.id,
          display_name: joinName || profile?.display_name || 'Player',
          total_buyin: buyinAmount,
        })
        .select()
        .single();
      if (playerErr) throw playerErr;

      if (buyinAmount > 0) {
        await supabase.from('buy_ins').insert({
          session_id: session.id,
          session_player_id: player.id,
          amount: buyinAmount,
          is_rebuy: false,
        });
      }
      setJoinOpen(false);
      navigate(`/session/${session.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to join session');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box sx={{ px: 2, pt: 3, pb: 2, maxWidth: 600, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={800} sx={{ color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1 }}>
            <CasinoIcon /> Poker Ledger
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Hey, {profile?.display_name ?? 'Player'} 👋
          </Typography>
        </Box>
        <Avatar
          sx={{ bgcolor: 'primary.dark', color: 'primary.contrastText', width: 44, height: 44, fontWeight: 700 }}
        >
          {(profile?.display_name ?? 'P')[0].toUpperCase()}
        </Avatar>
      </Box>

      {/* Quick Stats */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1.5, mb: 3 }}>
        {[
          { label: 'Net Profit', value: formatMoney(myStats.net), color: myStats.net >= 0 ? 'success.main' : 'error.main' },
          { label: 'Sessions', value: myStats.sessions },
          { label: 'Win Rate', value: `${myStats.winRate.toFixed(0)}%` },
        ].map((stat) => (
          <Card key={stat.label} sx={{ textAlign: 'center' }}>
            <CardContent sx={{ py: 1.5, px: 1, '&:last-child': { pb: 1.5 } }}>
              <Typography variant="h6" fontWeight={700} sx={{ color: (stat as { color?: string }).color ?? 'text.primary', fontSize: '1.1rem' }}>
                {stat.value}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                {stat.label}
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Box>

      {/* Active Session Banner */}
      {activeSession && (
        <Card
          sx={{
            mb: 3,
            background: 'linear-gradient(135deg, rgba(74,222,128,0.15), rgba(22,163,74,0.1))',
            border: '1px solid rgba(74,222,128,0.3)',
          }}
        >
          <CardActionArea onClick={() => navigate(`/session/${activeSession.id}`)} sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <FiberManualRecordIcon sx={{ color: 'success.main', fontSize: 12, animation: 'pulse 1.5s infinite' }} />
                  <Typography variant="caption" color="success.main" fontWeight={700}>
                    LIVE SESSION
                  </Typography>
                </Box>
                <Typography variant="h6" fontWeight={700}>{activeSession.title}</Typography>
                <Typography variant="caption" color="text.secondary">
                  Code: {activeSession.join_code}
                </Typography>
              </Box>
              <Button variant="contained" color="primary" size="small">
                Rejoin
              </Button>
            </Box>
          </CardActionArea>
        </Card>
      )}

      {/* Action Buttons */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 3 }}>
        <Button
          variant="contained"
          color="primary"
          size="large"
          startIcon={<AddIcon />}
          onClick={() => { setCreateOpen(true); setError(''); }}
          sx={{ py: 2, fontSize: '1rem' }}
        >
          New Session
        </Button>
        <Button
          variant="outlined"
          color="primary"
          size="large"
          startIcon={<GroupAddIcon />}
          onClick={() => { setJoinOpen(true); setError(''); }}
          sx={{ py: 2, fontSize: '1rem' }}
        >
          Join Session
        </Button>
      </Box>

      {/* Recent Sessions */}
      {recentSessions.length > 0 && (
        <>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5, color: 'text.secondary' }}>
            Recent Sessions
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {recentSessions.map((session) => (
              <Card key={session.id} sx={{ cursor: 'pointer' }}>
                <CardActionArea onClick={() => navigate(`/session/${session.id}/summary`)}>
                  <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box>
                        <Typography variant="body1" fontWeight={600}>{session.title}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatDate(session.ended_at ?? session.created_at)} · {session.player_count} players
                        </Typography>
                      </Box>
                      {session.my_result !== undefined && session.my_result !== null && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          {session.my_result >= 0
                            ? <TrendingUpIcon sx={{ color: 'success.main', fontSize: 18 }} />
                            : <TrendingDownIcon sx={{ color: 'error.main', fontSize: 18 }} />}
                          <Typography
                            variant="body2"
                            fontWeight={700}
                            sx={{ color: session.my_result >= 0 ? 'success.main' : 'error.main' }}
                          >
                            {formatMoney(session.my_result)}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  </CardContent>
                </CardActionArea>
              </Card>
            ))}
          </Box>
        </>
      )}

      {/* Create Session Dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 700 }}>Start New Session</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Session Name"
              value={sessionTitle}
              onChange={(e) => setSessionTitle(e.target.value)}
              fullWidth
            />
            <TextField
              label="Your Buy-In Amount ($)"
              value={createBuyin}
              onChange={(e) => setCreateBuyin(e.target.value)}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCreateOpen(false)} color="inherit">Cancel</Button>
          <Button variant="contained" onClick={handleCreateSession} disabled={loading}>
            {loading ? 'Creating...' : 'Create Session'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Join Session Dialog */}
      <Dialog open={joinOpen} onClose={() => setJoinOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 700 }}>Join Session</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Join Code"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              inputProps={{ maxLength: 6, style: { letterSpacing: 4, fontWeight: 700, fontSize: '1.2rem' } }}
              placeholder="ABC123"
              fullWidth
            />
            <TextField
              label="Your Name"
              value={joinName}
              onChange={(e) => setJoinName(e.target.value)}
              fullWidth
            />
            <TextField
              label="Buy-In Amount ($)"
              type="number"
              value={joinBuyin}
              onChange={(e) => setJoinBuyin(e.target.value)}
              fullWidth
              inputProps={{ min: 0, step: 5 }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setJoinOpen(false)} color="inherit">Cancel</Button>
          <Button variant="contained" onClick={handleJoinSession} disabled={loading}>
            {loading ? 'Joining...' : 'Join Session'}
          </Button>
        </DialogActions>
      </Dialog>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </Box>
  );
}
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Avatar from '@mui/material/Avatar';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import IconButton from '@mui/material/IconButton';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import LinearProgress from '@mui/material/LinearProgress';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import PaymentsIcon from '@mui/icons-material/Payments';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import type { Session, SessionPlayer } from '../types';

function formatMoney(val: number) {
  const abs = Math.abs(val);
  const formatted = abs % 1 === 0 ? `$${abs}` : `$${abs.toFixed(2)}`;
  return val >= 0 ? `+${formatted}` : `-${formatted}`;
}

function formatDuration(start: string, end?: string | null) {
  const ms = new Date(end ?? new Date()).getTime() - new Date(start).getTime();
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function SessionSummaryPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [players, setPlayers] = useState<SessionPlayer[]>([]);
  const [isHost, setIsHost] = useState(false);
  const [isCohost, setIsCohost] = useState(false);
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [approvalReason, setApprovalReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [approved, setApproved] = useState(false);

  const loadData = useCallback(async () => {
    if (!sessionId) return;
    const { data: s } = await supabase.from('sessions').select('*').eq('id', sessionId).single();
    if (!s) return;
    setSession(s as Session);
    setIsHost(s.host_id === user?.id);

    const { data: playerRows } = await supabase
      .from('session_players')
      .select('*')
      .eq('session_id', sessionId)
      .order('result', { ascending: false });
    setPlayers((playerRows ?? []) as SessionPlayer[]);

    // Check if current user is a cohost
    const currentUserPlayer = (playerRows ?? []).find((p) => p.user_id === user?.id);
    setIsCohost(currentUserPlayer?.is_cohost === true);

    const { data: approvalRow } = await supabase
      .from('approvals')
      .select('id')
      .eq('session_id', sessionId)
      .single();
    setApproved(!!approvalRow);
  }, [sessionId, user?.id]);

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel(`summary:${sessionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'session_players', filter: `session_id=eq.${sessionId}` }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions', filter: `id=eq.${sessionId}` }, loadData)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [loadData, sessionId]);

  // Compute totals
  const totalBuyins = players.reduce((s, p) => s + Number(p.total_buyin), 0);
  const totalCashouts = players.filter((p) => p.cashout !== null).reduce((s, p) => s + Number(p.cashout), 0);
  const diff = totalCashouts - totalBuyins;
  const hasDiff = Math.abs(diff) > 0.01;
  const playersWithCashout = players.filter((p) => p.cashout !== null && p.result !== null);
  const sorted = [...playersWithCashout].sort((a, b) => Number(b.result) - Number(a.result));
  const winner = sorted[0];
  const loser = sorted[sorted.length - 1];
  const allCashedOut = players.length > 0 && players.every((p) => p.cashout !== null);

  async function handleApproveAndClose() {
    if (!sessionId || !user) return;
    setLoading(true);
    try {
      await supabase.from('approvals').insert({
        session_id: sessionId,
        approved_by: user.id,
        difference: diff,
        reason: approvalReason || null,
      });

      // Assign positions
      for (let i = 0; i < sorted.length; i++) {
        await supabase
          .from('session_players')
          .update({ position: i + 1 })
          .eq('id', sorted[i].id);
      }

      // Close session if still active
      if (session?.status === 'active') {
        await supabase.from('sessions').update({ status: 'closed', ended_at: new Date().toISOString() }).eq('id', sessionId);
      }

      setApprovalOpen(false);
      setApproved(true);
      loadData();
    } finally {
      setLoading(false);
    }
  }

  if (!session) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <Typography color="text.secondary">Loading...</Typography>
    </Box>
  );

  return (
    <Box sx={{ pb: 10 }}>
      <AppBar position="sticky" sx={{ bgcolor: 'background.paper', borderBottom: '1px solid', borderColor: 'divider' }} elevation={0}>
        <Toolbar>
          <IconButton edge="start" onClick={() => navigate('/')} sx={{ mr: 1 }}>
            <ArrowBackIcon />
          </IconButton>
          <Box>
            <Typography variant="h6" fontWeight={700}>{session.title}</Typography>
            <Typography variant="caption" color="text.secondary">Session Summary</Typography>
          </Box>
          {approved && <CheckCircleIcon sx={{ ml: 'auto', color: 'success.main' }} />}
        </Toolbar>
      </AppBar>

      <Box sx={{ px: 2, pt: 2, maxWidth: 600, mx: 'auto' }}>
        {/* Session Overview */}
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="subtitle2" color="text.secondary" fontWeight={700} sx={{ mb: 1.5 }}>SESSION OVERVIEW</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
              {[
                { label: 'Date', value: new Date(session.started_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) },
                { label: 'Duration', value: formatDuration(session.started_at, session.ended_at) },
                { label: 'Players', value: players.length },
                { label: 'Total Buy-Ins', value: `$${totalBuyins.toFixed(0)}` },
              ].map((item) => (
                <Box key={item.label}>
                  <Typography variant="caption" color="text.secondary">{item.label}</Typography>
                  <Typography variant="body1" fontWeight={700}>{item.value}</Typography>
                </Box>
              ))}
            </Box>
          </CardContent>
        </Card>

        {/* Winner / Loser */}
        {winner && loser && winner.id !== loser.id && (
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, mb: 2 }}>
            <Card sx={{ background: 'linear-gradient(135deg, rgba(74,222,128,0.12), rgba(22,163,74,0.08))', border: '1px solid rgba(74,222,128,0.25)' }}>
              <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
                <EmojiEventsIcon sx={{ color: 'secondary.main', mb: 0.5 }} />
                <Typography variant="caption" color="text.secondary" display="block">Biggest Winner</Typography>
                <Typography variant="body1" fontWeight={800}>{winner.display_name}</Typography>
                <Typography variant="body2" fontWeight={700} sx={{ color: 'success.main' }}>
                  {formatMoney(Number(winner.result))}
                </Typography>
              </CardContent>
            </Card>
            <Card sx={{ background: 'linear-gradient(135deg, rgba(248,113,113,0.1), rgba(220,38,38,0.06))', border: '1px solid rgba(248,113,113,0.2)' }}>
              <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
                <TrendingDownIcon sx={{ color: 'error.main', mb: 0.5 }} />
                <Typography variant="caption" color="text.secondary" display="block">Biggest Loser</Typography>
                <Typography variant="body1" fontWeight={800}>{loser.display_name}</Typography>
                <Typography variant="body2" fontWeight={700} sx={{ color: 'error.main' }}>
                  {formatMoney(Number(loser.result))}
                </Typography>
              </CardContent>
            </Card>
          </Box>
        )}

        {/* Leaderboard */}
        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>Results</Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
          {sorted.map((player, idx) => {
            const result = Number(player.result);
            const buyin = Number(player.total_buyin);
            const cashout = Number(player.cashout);
            const absoluteDiffPct = buyin > 0 ? (Math.abs(result) / buyin) * 100 : 0;

            return (
              <Card key={player.id}>
                <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Typography
                      variant="h6"
                      fontWeight={800}
                      sx={{ width: 28, color: idx === 0 ? 'secondary.main' : 'text.secondary' }}
                    >
                      {idx + 1}
                    </Typography>
                    <Avatar sx={{ bgcolor: result >= 0 ? 'primary.dark' : 'error.dark', width: 36, height: 36, fontSize: '0.875rem', fontWeight: 700 }}>
                      {player.display_name[0].toUpperCase()}
                    </Avatar>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2" fontWeight={700}>{player.display_name}</Typography>
                      <LinearProgress
                        variant="determinate"
                        value={Math.min(absoluteDiffPct, 100)}
                        sx={{
                          mt: 0.5,
                          bgcolor: result >= 0 ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.5)', 
                          '& .MuiLinearProgress-bar': {
                            bgcolor: result >= 0 ? 'success.main' : 'error.main', 
                          },
                        }}
                      />
                    </Box>
                    <Box sx={{ textAlign: 'right', minWidth: 64 }}>
                      <Typography
                        variant="body2"
                        fontWeight={800}
                        sx={{ color: result >= 0 ? 'success.main' : 'error.main' }}
                      >
                        {formatMoney(result)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        ${buyin} → ${cashout}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            );
          })}

          {players.filter((p) => p.cashout === null).map((player) => (
            <Card key={player.id} sx={{ opacity: 0.6 }}>
              <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Avatar sx={{ bgcolor: 'grey.700', width: 36, height: 36, fontSize: '0.875rem' }}>
                    {player.display_name[0].toUpperCase()}
                  </Avatar>
                  <Typography variant="body2">{player.display_name}</Typography>
                  <Chip label="No cash-out" size="small" sx={{ ml: 'auto' }} />
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>

        {/* Accounting check */}
        {allCashedOut && hasDiff && (
          <Alert
            severity="warning"
            icon={<WarningAmberIcon />}
            sx={{ mb: 2 }}
          >
            <AlertTitle>Accounting Difference Detected</AlertTitle>
            Buy-ins: ${totalBuyins.toFixed(2)} · Cash-outs: ${totalCashouts.toFixed(2)} ·{' '}
            Difference: {formatMoney(diff)}
          </Alert>
        )}

        {/* Host/Cohost Actions */}
        {(isHost || isCohost) && !approved && (
          <Button
            variant="contained"
            color={hasDiff ? 'warning' : 'primary'}
            fullWidth
            size="large"
            sx={{ py: 1.8, fontSize: '1rem', mb: 1.5 }}
            onClick={() => setApprovalOpen(true)}
          >
            {hasDiff ? 'Approve with Difference & Save' : 'Approve & Save Session'}
          </Button>
        )}

        {!isHost && !isCohost && !approved && (
          <Box sx={{ display: 'flex', gap: 1.5, mb: 1.5 }}>
            <Button
              variant="outlined"
              fullWidth
              onClick={() => navigate(`/session/${sessionId}/cashout`)}
            >
              Edit Cash-Out
            </Button>
          </Box>
        )}

        {approved && (
          <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mb: 2 }}>
            Session approved and saved to history.
          </Alert>
        )}
        {approved && (
          <Button
            variant="outlined"
            color="success"
            fullWidth
            size="large"
            startIcon={<PaymentsIcon />} /* or any icon you like, e.g., SyncAltIcon */
            onClick={() => navigate(`/session/${sessionId}/settle`)}
            sx={{ 
              py: 1.8, 
              fontSize: '1rem',
              borderWidth: '2px',
              '&:hover': { borderWidth: '2px' }
            }}
            >
            Settle Debts
            </Button>
        )}
      </Box>

      {/* Approval Dialog */}
      <Dialog open={approvalOpen} onClose={() => setApprovalOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle fontWeight={700}>Approve Session</DialogTitle>
        <DialogContent>
          {hasDiff && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Difference of {formatMoney(diff)} will be recorded.
            </Alert>
          )}
          <TextField
            label="Note (optional)"
            value={approvalReason}
            onChange={(e) => setApprovalReason(e.target.value)}
            fullWidth
            multiline
            rows={2}
            placeholder="e.g. Lost coins in the couch"
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setApprovalOpen(false)} color="inherit">Cancel</Button>
          <Button variant="contained" onClick={handleApproveAndClose} disabled={loading}>
            Approve & Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import LinearProgress from '@mui/material/LinearProgress';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import LeaderboardIcon from '@mui/icons-material/Leaderboard';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { supabase } from '../lib/supabase';

interface LeaderEntry {
  user_id: string;
  display_name: string;
  value: number;
  sessions: number;
}

function formatMoney(val: number) {
  const abs = Math.abs(val);
  const str = `$${abs % 1 === 0 ? abs : abs.toFixed(2)}`;
  return val >= 0 ? `+${str}` : `-${str}`;
}

const RANK_COLORS = ['#fbbf24', '#94a3b8', '#cd7f32'];

export default function LeaderboardPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);
  const [profitBoard, setProfitBoard] = useState<LeaderEntry[]>([]);
  const [roiBoard, setRoiBoard] = useState<LeaderEntry[]>([]);
  const [activeBoard, setActiveBoard] = useState<LeaderEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLeaderboards = useCallback(async () => {
    const { data: players } = await supabase
      .from('session_players')
      .select('user_id, display_name, result, total_buyin, sessions(status)')
      .not('user_id', 'is', null)
      .not('result', 'is', null);

    const filtered = (players ?? []).filter(
      (p) => ((p.sessions as unknown as { status: string } | null)?.status === 'closed')
    );

    // Aggregate per user
    const map = new Map<string, { display_name: string; net: number; buyin: number; count: number }>();
    for (const p of filtered) {
      const uid = p.user_id as string;
      const name = (p.display_name as string | null) ?? 'Unknown';
      const existing = map.get(uid) ?? { display_name: name, net: 0, buyin: 0, count: 0 };
      existing.net += Number(p.result);
      existing.buyin += Number(p.total_buyin);
      existing.count += 1;
      map.set(uid, existing);
    }

    const entries = Array.from(map.entries()).map(([uid, d]) => ({
      user_id: uid,
      display_name: d.display_name,
      sessions: d.count,
      net: d.net,
      roi: d.buyin > 0 ? (d.net / d.buyin) * 100 : 0,
      count: d.count,
    }));

    setProfitBoard(
      [...entries]
        .sort((a, b) => b.net - a.net)
        .slice(0, 20)
        .map((e) => ({ user_id: e.user_id, display_name: e.display_name, value: e.net, sessions: e.sessions }))
    );

    setRoiBoard(
      [...entries]
        .filter((e) => e.sessions >= 3)
        .sort((a, b) => b.roi - a.roi)
        .slice(0, 20)
        .map((e) => ({ user_id: e.user_id, display_name: e.display_name, value: e.roi, sessions: e.sessions }))
    );

    setActiveBoard(
      [...entries]
        .sort((a, b) => b.count - a.count)
        .slice(0, 20)
        .map((e) => ({ user_id: e.user_id, display_name: e.display_name, value: e.count, sessions: e.sessions }))
    );

    setLoading(false);
  }, []);

  useEffect(() => { loadLeaderboards(); }, [loadLeaderboards]);

  const boards = [profitBoard, roiBoard, activeBoard];
  const currentBoard = boards[tab] ?? [];
  const maxVal = currentBoard.length > 0 ? Math.abs(currentBoard[0].value) : 1;

  function formatValue(val: number, tabIdx: number) {
    if (tabIdx === 0) return formatMoney(val);
    if (tabIdx === 1) return `${val >= 0 ? '+' : ''}${val.toFixed(1)}%`;
    return `${val} sessions`;
  }

  return (
    <Box sx={{ px: 2, pt: 3, pb: 2, maxWidth: 600, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <LeaderboardIcon sx={{ color: 'secondary.main' }} />
        <Typography variant="h5" fontWeight={800}>Leaderboards</Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>All-time rankings</Typography>

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v as number)}
        sx={{ mb: 3 }}
        textColor="primary"
        indicatorColor="primary"
        variant="fullWidth"
      >
        <Tab label="Profit" />
        <Tab label="ROI" />
        <Tab label="Active" />
      </Tabs>

      {tab === 1 && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
          Min. 3 sessions required
        </Typography>
      )}

      {loading ? (
        <LinearProgress color="primary" />
      ) : currentBoard.length === 0 ? (
        <Card sx={{ textAlign: 'center', py: 6 }}>
          <CardContent>
            <EmojiEventsIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
            <Typography color="text.secondary">No data yet. Play some sessions!</Typography>
          </CardContent>
        </Card>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {currentBoard.map((entry, idx) => (
            <Card
              key={entry.user_id}
              sx={{
                border: idx < 3 ? `1px solid ${RANK_COLORS[idx]}40` : '1px solid rgba(74,222,128,0.1)',
              }}
            >
              <CardActionArea onClick={() => navigate(`/player/${entry.user_id}`)}>
                <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Typography
                      variant="h6"
                      fontWeight={800}
                      sx={{ width: 28, color: idx < 3 ? RANK_COLORS[idx] : 'text.secondary', fontSize: idx < 3 ? '1.2rem' : '1rem' }}
                    >
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                    </Typography>
                    <Avatar
                      sx={{ bgcolor: idx < 3 ? RANK_COLORS[idx] : 'primary.dark', width: 36, height: 36, fontSize: '0.875rem', fontWeight: 700, color: '#000' }}
                    >
                      {entry.display_name[0].toUpperCase()}
                    </Avatar>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2" fontWeight={700}>{entry.display_name}</Typography>
                      <LinearProgress
                        variant="determinate"
                        value={Math.min((Math.abs(entry.value) / maxVal) * 100, 100)}
                        sx={{
                          mt: 0.5,
                          '& .MuiLinearProgress-bar': {
                            bgcolor: idx < 3 ? RANK_COLORS[idx] : 'primary.main',
                          },
                        }}
                      />
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Box sx={{ textAlign: 'right' }}>
                        <Typography
                          variant="body2"
                          fontWeight={800}
                          sx={{ color: tab === 2 ? 'text.primary' : entry.value >= 0 ? 'success.main' : 'error.main' }}
                        >
                          {formatValue(entry.value, tab)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {entry.sessions} sess.
                        </Typography>
                      </Box>
                      <ChevronRightIcon sx={{ color: 'text.disabled', fontSize: 18 }} />
                    </Box>
                  </Box>
                </CardContent>
              </CardActionArea>
            </Card>
          ))}
        </Box>
      )}
    </Box>
  );
}

import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CallMadeIcon from "@mui/icons-material/CallMade";
import CallReceivedIcon from "@mui/icons-material/CallReceived";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import TrendingFlatIcon from "@mui/icons-material/TrendingFlat";
import Alert from "@mui/material/Alert";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import IconButton from "@mui/material/IconButton";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import {
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  useNavigate,
  useParams,
} from "react-router-dom";
import { supabase } from "../lib/supabase";
import type { SessionPlayer } from "../types";

interface Transaction {
  from: string;
  to: string;
  amount: number;
}

function calculateSettlements(
  players: { name: string; net: number }[],
): Transaction[] {
  const debtors = players
    .filter((p) => p.net < 0)
    .map((p) => ({ ...p, net: Math.abs(p.net) }))
    .sort((a, b) => b.net - a.net);

  const creditors = players
    .filter((p) => p.net > 0)
    .sort((a, b) => b.net - a.net);

  const transactions: Transaction[] = [];
  let dIdx = 0;
  let cIdx = 0;

  while (
    dIdx < debtors.length &&
    cIdx < creditors.length
  ) {
    const debtor = debtors[dIdx];
    const creditor = creditors[cIdx];
    const amountToTransfer = Math.min(
      debtor.net,
      creditor.net,
    );

    if (amountToTransfer > 0.01) {
      transactions.push({
        from: debtor.name,
        to: creditor.name,
        amount: Number(
          amountToTransfer.toFixed(2),
        ),
      });
    }

    debtor.net -= amountToTransfer;
    creditor.net -= amountToTransfer;

    if (debtor.net < 0.01) dIdx++;
    if (creditor.net < 0.01) cIdx++;
  }

  return transactions;
}

export default function SettlementPage() {
  const { sessionId } = useParams<{
    sessionId: string;
  }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] =
    useState<Transaction[]>([]);
  const [ledgerUnbalanced, setLedgerUnbalanced] =
    useState(false);
  const [
    isGraceCorrection,
    setIsGraceCorrection,
  ] = useState(false);
  const [
    discrepancyAmount,
    setDiscrepancyAmount,
  ] = useState(0);

  // Track individual correction values to display in brackets next to names
  const [corrections, setCorrections] = useState<
    Record<string, number>
  >({});

  // Toggle between 'owes' (Debtors view) and 'receives' (Creditors view)
  const [viewMode, setViewMode] = useState<
    "owes" | "receives"
  >("owes");

  const loadSettlementData =
    useCallback(async () => {
      if (!sessionId) return;
      setLoading(true);

      const { data: rows } = await supabase
        .from("session_players")
        .select("*")
        .eq("session_id", sessionId);

      const players = (rows ??
        []) as SessionPlayer[];

      let totalBuyins = 0;
      let totalCashouts = 0;
      const localCorrections: Record<
        string,
        number
      > = {};

      let formattedData = players.map((p) => {
        const buyin = Number(p.total_buyin ?? 0);
        const cashout = Number(p.cashout ?? 0);
        totalBuyins += buyin;
        totalCashouts += cashout;

        localCorrections[p.display_name] = 0; // Initialize everyone to 0

        return {
          name: p.display_name,
          net: cashout - buyin,
        };
      });

      const diff = totalCashouts - totalBuyins;
      const absDiff = Math.abs(diff);

      if (absDiff > 0.001) {
        setLedgerUnbalanced(true);
        setDiscrepancyAmount(diff);

        if (absDiff < 1.0) {
          setIsGraceCorrection(true);

          if (diff < 0) {
            // Missing cash: Deduct loss from the biggest winner
            formattedData.sort(
              (a, b) => b.net - a.net,
            );
            if (
              formattedData[0] &&
              formattedData[0].net > 0
            ) {
              formattedData[0].net += diff;
              localCorrections[
                formattedData[0].name
              ] = diff; // Will capture e.g. -0.30
            }
          } else {
            // Extra cash: Add gain to the biggest loser
            formattedData.sort(
              (a, b) => a.net - b.net,
            );
            if (
              formattedData[0] &&
              formattedData[0].net < 0
            ) {
              formattedData[0].net += diff;
              localCorrections[
                formattedData[0].name
              ] = diff; // Will capture e.g. +0.30
            }
          }
          setTransactions(
            calculateSettlements(formattedData),
          );
        } else {
          setIsGraceCorrection(false);
          setTransactions([]);
        }
      } else {
        setLedgerUnbalanced(false);
        setIsGraceCorrection(false);
        setTransactions(
          calculateSettlements(formattedData),
        );
      }

      setCorrections(localCorrections);
      setLoading(false);
    }, [sessionId]);

  useEffect(() => {
    loadSettlementData();
  }, [loadSettlementData]);

  // View Grouping 1: Group by who OWES (Debtors)
  const groupedDebts = transactions.reduce(
    (groups, tx) => {
      if (!groups[tx.from]) groups[tx.from] = [];
      groups[tx.from].push(tx);
      return groups;
    },
    {} as Record<string, Transaction[]>,
  );

  // View Grouping 2: Group by who RECEIVES (Creditors)
  const groupedReceipts = transactions.reduce(
    (groups, tx) => {
      if (!groups[tx.to]) groups[tx.to] = [];
      groups[tx.to].push(tx);
      return groups;
    },
    {} as Record<string, Transaction[]>,
  );

  // Small string helper to show discrepancy adjustment indicators
  const renderCorrectionLabel = (
    name: string,
  ) => {
    const val = corrections[name];
    if (!val || Math.abs(val) < 0.001)
      return null;
    const formatted =
      val > 0
        ? `+$${val.toFixed(2)} extra cash`
        : `-$${Math.abs(val).toFixed(2)} took loss`;
    return (
      <Typography
        component="span"
        variant="caption"
        sx={{
          color:
            val > 0
              ? "success.main"
              : "warning.main",
          ml: 1,
          fontWeight: 500,
        }}
      >
        ({formatted})
      </Typography>
    );
  };

  if (loading)
    return (
      <Typography
        sx={{ p: 4, textAlign: "center" }}
      >
        Balancing books...
      </Typography>
    );

  return (
    <Box sx={{ pb: 10 }}>
      <AppBar
        position="sticky"
        sx={{
          bgcolor: "background.paper",
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
        elevation={0}
      >
        <Toolbar>
          <IconButton
            edge="start"
            onClick={() =>
              navigate(`/session/${sessionId}`)
            }
            sx={{ mr: 1 }}
          >
            <ArrowBackIcon />
          </IconButton>
          <Typography
            variant="h6"
            fontWeight={700}
            sx={{ color: "text.primary" }}
          >
            Expense Settlement
          </Typography>
        </Toolbar>
      </AppBar>

      <Box
        sx={{
          px: 2,
          pt: 3,
          maxWidth: 500,
          mx: "auto",
        }}
      >
        {ledgerUnbalanced && (
          <Alert
            severity={
              isGraceCorrection
                ? "info"
                : "warning"
            }
            sx={{ mb: 3 }}
          >
            <Typography
              variant="body2"
              fontWeight={700}
            >
              {isGraceCorrection
                ? "Minor Fractional Correction Applied"
                : "Table Ledger Unbalanced!"}
            </Typography>
            Total buy-ins do not equal total
            cash-outs. The table is off by
            <strong>
              {" "}
              {discrepancyAmount > 0
                ? `+$${discrepancyAmount.toFixed(2)}`
                : `-$${Math.abs(discrepancyAmount).toFixed(2)}`}
            </strong>
            .
            {isGraceCorrection ? (
              <span>
                {" "}
                Loose change balances
                auto-allocated to ensure
                settlements generate perfectly.
                Check brackets below.
              </span>
            ) : (
              <span>
                {" "}
                Please review entries before
                settling debts.Mismatches greater
                than $1.00 block generation.
              </span>
            )}
          </Alert>
        )}

        {/* View Selection Toggle System */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            mb: 3,
          }}
        >
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(_, val) =>
              val && setViewMode(val)
            }
            size="small"
            color="primary"
            fullWidth
          >
            <ToggleButton
              value="owes"
              sx={{ fontWeight: 700, gap: 0.5 }}
            >
              <CallMadeIcon fontSize="inherit" />{" "}
              Who Owes Whom
            </ToggleButton>
            <ToggleButton
              value="receives"
              sx={{ fontWeight: 700, gap: 0.5 }}
            >
              <CallReceivedIcon fontSize="inherit" />{" "}
              Who Receives What
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {transactions.length === 0 &&
          (!ledgerUnbalanced ||
            !isGraceCorrection) && (
            <Card
              sx={{
                textAlign: "center",
                py: 4,
                border: "1px dashed",
                borderColor: "divider",
              }}
            >
              <CheckCircleOutlineIcon
                color="success"
                sx={{ fontSize: 50, mb: 1 }}
              />
              <Typography
                variant="body1"
                fontWeight={700}
              >
                Everyone is Settled!
              </Typography>
            </Card>
          )}

        {/* RENDER VIEW 1: WHO OWES WHOM */}
        {viewMode === "owes" && (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: 2.5,
            }}
          >
            {Object.entries(groupedDebts).map(
              ([debtorName, debts]) => {
                const totalOwedByThisPerson =
                  debts.reduce(
                    (sum, d) => sum + d.amount,
                    0,
                  );
                return (
                  <Box key={debtorName}>
                    <Typography
                      variant="subtitle2"
                      fontWeight={800}
                      color="error.main"
                      sx={{ mb: 1 }}
                    >
                      {debtorName} owes a total of
                      $
                      {totalOwedByThisPerson.toFixed(
                        2,
                      )}
                      :
                      {renderCorrectionLabel(
                        debtorName,
                      )}
                    </Typography>

                    <Box
                      sx={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 1,
                        pl: 2,
                        borderLeft:
                          "2px solid rgba(239,68,68,0.2)",
                      }}
                    >
                      {debts.map(
                        (debt, index) => (
                          <Card
                            key={index}
                            variant="outlined"
                            sx={{
                              bgcolor:
                                "background.default",
                            }}
                          >
                            <CardContent
                              sx={{
                                py: 1.5,
                                px: 2,
                                "&:last-child": {
                                  pb: 1.5,
                                },
                                display: "flex",
                                alignItems:
                                  "center",
                                justifyContent:
                                  "space-between",
                              }}
                            >
                              <Box
                                sx={{
                                  display: "flex",
                                  alignItems:
                                    "center",
                                  gap: 1,
                                }}
                              >
                                <Typography
                                  variant="body2"
                                  fontWeight={600}
                                >
                                  {debt.from}
                                </Typography>
                                <TrendingFlatIcon
                                  color="action"
                                  sx={{
                                    fontSize: 16,
                                  }}
                                />
                                <Typography
                                  variant="body2"
                                  color="text.secondary"
                                >
                                  pays
                                </Typography>
                                <Typography
                                  variant="body2"
                                  fontWeight={700}
                                >
                                  {debt.to}
                                </Typography>
                              </Box>
                              <Typography
                                variant="body1"
                                fontWeight={800}
                                color="success.main"
                              >
                                $
                                {debt.amount.toFixed(
                                  2,
                                )}
                              </Typography>
                            </CardContent>
                          </Card>
                        ),
                      )}
                    </Box>
                  </Box>
                );
              },
            )}
          </Box>
        )}

        {/* RENDER VIEW 2: WHO RECEIVES WHAT (REVERSE VIEW) */}
        {viewMode === "receives" && (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: 2.5,
            }}
          >
            {Object.entries(groupedReceipts).map(
              ([creditorName, receipts]) => {
                const totalReceivedByThisPerson =
                  receipts.reduce(
                    (sum, r) => sum + r.amount,
                    0,
                  );
                return (
                  <Box key={creditorName}>
                    <Typography
                      variant="subtitle2"
                      fontWeight={800}
                      color="success.main"
                      sx={{ mb: 1 }}
                    >
                      {creditorName} receives a
                      total of $
                      {totalReceivedByThisPerson.toFixed(
                        2,
                      )}
                      :
                      {renderCorrectionLabel(
                        creditorName,
                      )}
                    </Typography>

                    <Box
                      sx={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 1,
                        pl: 2,
                        borderLeft:
                          "2px solid rgba(74,222,128,0.3)",
                      }}
                    >
                      {receipts.map(
                        (receipt, index) => (
                          <Card
                            key={index}
                            variant="outlined"
                            sx={{
                              bgcolor:
                                "background.default",
                            }}
                          >
                            <CardContent
                              sx={{
                                py: 1.5,
                                px: 2,
                                "&:last-child": {
                                  pb: 1.5,
                                },
                                display: "flex",
                                alignItems:
                                  "center",
                                justifyContent:
                                  "space-between",
                              }}
                            >
                              <Box
                                sx={{
                                  display: "flex",
                                  alignItems:
                                    "center",
                                  gap: 1,
                                }}
                              >
                                <Typography
                                  variant="body2"
                                  fontWeight={700}
                                >
                                  {receipt.to}
                                </Typography>
                                <Typography
                                  variant="body2"
                                  color="text.secondary"
                                >
                                  gets paid by
                                </Typography>
                                <Typography
                                  variant="body2"
                                  fontWeight={600}
                                >
                                  {receipt.from}
                                </Typography>
                              </Box>
                              <Typography
                                variant="body1"
                                fontWeight={800}
                                color="success.main"
                              >
                                $
                                {receipt.amount.toFixed(
                                  2,
                                )}
                              </Typography>
                            </CardContent>
                          </Card>
                        ),
                      )}
                    </Box>
                  </Box>
                );
              },
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
}

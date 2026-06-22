import type { CrewTicketReportSpends } from '../../api/ticket';

const METRIC_BAR_COLORS = ['blue', 'teal', 'amber', 'green', 'blue'] as const;

export interface SpendDashboardStats {
  bookingsInScope: number;
  mtdSpend: { total: number; count: number; average: number };
  spendChangeMeta: string;
  spendChangeTone: 'up' | 'down' | 'flat';
  avgCostMeta: string;
  spendByDestination: Array<{ label: string; amount: number; barPct: number; color: string }>;
  bookingsByClass: Array<{ label: string; count: number; pct: number }>;
  destinationCount: number;
  spendMtdBarPct: number;
  avgCostBarPct: number;
}

export const EMPTY_SPEND_DASHBOARD_STATS: SpendDashboardStats = {
  bookingsInScope: 0,
  mtdSpend: { total: 0, count: 0, average: 0 },
  spendChangeMeta: 'No priced bookings this month',
  spendChangeTone: 'flat',
  avgCostMeta: 'No priced bookings this month',
  spendByDestination: [],
  bookingsByClass: [],
  destinationCount: 0,
  spendMtdBarPct: 0,
  avgCostBarPct: 0,
};

function formatSpendChangeMeta(
  comparison: CrewTicketReportSpends['comparison'],
  pricedBookings: number
): { meta: string; tone: 'up' | 'down' | 'flat' } {
  if (pricedBookings === 0) {
    return { meta: 'No priced bookings this month', tone: 'flat' };
  }
  if (comparison.previousMonthTotalSpend === 0) {
    return { meta: 'No spend last month', tone: 'flat' };
  }

  const rounded = Math.round(Math.abs(comparison.percentChange));
  if (comparison.direction === 'up') {
    return { meta: `+${rounded}% vs last month`, tone: 'down' };
  }
  if (comparison.direction === 'down') {
    return { meta: `-${rounded}% vs last month`, tone: 'up' };
  }
  return { meta: 'Flat vs last month', tone: 'flat' };
}

/** Maps backend report spends payload into the Report Spends tab view model. */
export function buildSpendDashboardStats(
  reportSpends: CrewTicketReportSpends
): SpendDashboardStats {
  const { mtd, comparison, spendByDestination, bookingsByClass, scope, summary } = reportSpends;
  const { meta: spendChangeMeta, tone: spendChangeTone } = formatSpendChangeMeta(
    comparison,
    mtd.pricedBookings
  );

  const avgCostMeta = mtd.pricedBookings
    ? `${mtd.pricedBookings} priced booking${mtd.pricedBookings !== 1 ? 's' : ''}${
        mtd.topCabinClass ? ` · ${mtd.topCabinClass}` : ''
      }`
    : 'No priced bookings this month';

  const topDestinationSpend = spendByDestination[0]?.amount ?? 0;
  const spendByDestinationUi = spendByDestination.slice(0, 5).map((row, index) => ({
    label: row.label,
    amount: row.amount,
    barPct: topDestinationSpend ? Math.round((row.amount / topDestinationSpend) * 100) : 0,
    color: METRIC_BAR_COLORS[index % METRIC_BAR_COLORS.length],
  }));

  const combinedSpend = mtd.totalSpend + comparison.previousMonthTotalSpend;
  const spendMtdBarPct = combinedSpend
    ? Math.round((mtd.totalSpend / combinedSpend) * 100)
    : mtd.pricedBookings
      ? Math.min(100, mtd.pricedBookings * 10)
      : 0;

  return {
    bookingsInScope: scope.bookingsInScope,
    mtdSpend: {
      total: mtd.totalSpend,
      count: mtd.pricedBookings,
      average: mtd.averageTicketCost,
    },
    spendChangeMeta,
    spendChangeTone,
    avgCostMeta,
    spendByDestination: spendByDestinationUi,
    bookingsByClass: bookingsByClass.map((row) => ({
      label: row.label,
      count: row.count,
      pct: row.percent,
    })),
    destinationCount: summary.destinationCount,
    spendMtdBarPct,
    avgCostBarPct: mtd.pricedBookings ? Math.min(100, mtd.pricedBookings * 10) : 0,
  };
}

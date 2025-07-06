
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Badge } from '@/components/ui/badge';
import {
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  Download,
} from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#FF7C7C'];

const AnalyticsPage = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30d');
  const [expensesByCategory, setExpensesByCategory] = useState([]);
  const [incomeByCategory, setIncomeByCategory] = useState([]);
  const [transactionsByDate, setTransactionsByDate] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAnalyticsData();
  }, [period]);

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [expensesRes, incomeRes, transactionsRes, summaryRes, allTransactionsRes] = await Promise.all([
        apiClient.getExpensesByCategory({ period }),
        apiClient.getIncomeByCategory({ period }),
        apiClient.getTransactionsByDate({ period, groupBy: 'day', type: 'both' }),
        apiClient.getSummary({ period }),
        apiClient.getTransactions({ period }),
      ]);

      setExpensesByCategory(expensesRes.data);
      setIncomeByCategory(incomeRes.data);
      setTransactionsByDate(transactionsRes.data);
      setSummary(summaryRes.data);
      setTransactions(allTransactionsRes.data);
    } catch (error) {
      console.error('Failed to fetch analytics data:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: user?.currency || 'USD',
    }).format(amount);
  };

  const sanitizeCurrency = (amount) => {
    return formatCurrency(amount).replace(/[^\x20-\x7E]/g, '');
  };

  const formatCategoryName = (category) => {
    return category
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const processTransactionsByDate = () => {
    const dateMap = {};
    transactionsByDate.forEach((item) => {
      const date = item.date;
      if (!dateMap[date]) {
        dateMap[date] = { date, income: 0, expenses: 0 };
      }
      if (item.type === 'income') {
        dateMap[date].income = item.totalAmount;
      } else {
        dateMap[date].expenses = item.totalAmount;
      }
    });
    return Object.values(dateMap).sort((a, b) => new Date(a.date) - new Date(b.date));
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border rounded-lg p-3 shadow-lg">
          <p className="font-medium">{`${label}`}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }}>
              {`${entry.name}: ${formatCurrency(entry.value)}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const PieTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background border rounded-lg p-3 shadow-lg">
          <p className="font-medium">{formatCategoryName(data.category)}</p>
          <p style={{ color: payload[0].color }}>
            {`Amount: ${formatCurrency(data.totalAmount)}`}
          </p>
          <p className="text-sm text-muted-foreground">{`${data.percentage}% of total`}</p>
        </div>
      );
    }
    return null;
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();

    const green = "#10B981";
    const red = "#EF4444";
    const blue = "#2563EB";
    const orange = "#F59E42";

    doc.setFontSize(20);
    doc.setTextColor(33, 37, 41);
    doc.text('Finance Analytics Summary', 14, 18);

    doc.setFillColor(240, 240, 240);
    doc.roundedRect(10, 28, 90, 30, 3, 3, 'F');
    doc.roundedRect(110, 28, 90, 30, 3, 3, 'F');
    doc.roundedRect(10, 65, 90, 30, 3, 3, 'F');
    doc.roundedRect(110, 65, 90, 30, 3, 3, 'F');

    doc.setFontSize(12);
    doc.setTextColor(33, 37, 41);
    doc.text('Total Income', 16, 36);
    doc.setFontSize(18);
    doc.setTextColor(green);
    doc.text(sanitizeCurrency(summary?.totalIncome || 0), 16, 50);

    doc.setFontSize(12);
    doc.setTextColor(33, 37, 41);
    doc.text('Total Expenses', 116, 36);
    doc.setFontSize(18);
    doc.setTextColor(red);
    doc.text(sanitizeCurrency(summary?.totalExpenses || 0), 116, 50);

    doc.setFontSize(12);
    doc.setTextColor(33, 37, 41);
    doc.text('Net Amount', 16, 73);
    doc.setFontSize(18);
    doc.setTextColor(blue);
    doc.text(sanitizeCurrency(summary?.netAmount || 0), 16, 87);

    doc.setFontSize(12);
    doc.setTextColor(33, 37, 41);
    doc.text('Avg. Daily Expense', 116, 73);
    doc.setFontSize(18);
    doc.setTextColor(orange);
    doc.text(sanitizeCurrency(summary?.averageExpense || 0), 116, 87);

    doc.setFontSize(16);
    doc.setTextColor(33, 37, 41);
    doc.text('Top 10 Recent Transactions', 14, 110);

    const tableColumn = ["Date", "Type", "Description", "Category", "Amount"];
    const tableRows = [];

    const recentTransactions = [...transactions]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 10);

    recentTransactions.forEach((txn) => {
      tableRows.push([
        txn.date ? new Date(txn.date).toLocaleDateString() : "",
        txn.type ? txn.type.charAt(0).toUpperCase() + txn.type.slice(1) : "",
        txn.description || "",
        txn.category ? formatCategoryName(txn.category) : "",
        sanitizeCurrency(txn.amount || 0),
      ]);
    });

    autoTable(doc, {
      startY: 115,
      head: [tableColumn],
      body: tableRows,
      styles: { fontSize: 10 },
      headStyles: { fillColor: [33, 37, 41] },
      margin: { left: 14, right: 14 },
    });

    doc.save('analytics-summary.pdf');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500 mb-4">Failed to load analytics data</p>
        <Button onClick={fetchAnalyticsData}>Try Again</Button>
      </div>
    );
  }

  const chartData = processTransactionsByDate();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Analytics</h1>
          <p className="text-muted-foreground">
            Visualize your financial data with charts and insights
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleExportPDF}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Income</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(summary?.totalIncome || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {summary?.incomeCount || 0} transactions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(summary?.totalExpenses || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {summary?.expenseCount || 0} transactions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Amount</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${
              (summary?.netAmount || 0) >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {formatCurrency(summary?.netAmount || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {(summary?.netAmount || 0) >= 0 ? 'Surplus' : 'Deficit'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Daily Expense</CardTitle>
            <Calendar className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {formatCurrency(summary?.averageExpense || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Per transaction
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Expenses by Category Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Expenses by Category</CardTitle>
            <CardDescription>
              Breakdown of your spending by category
            </CardDescription>
          </CardHeader>
          <CardContent>
            {expensesByCategory.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={expensesByCategory}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ category, percentage }) => `${formatCategoryName(category)} (${percentage}%)`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="totalAmount"
                  >
                    {expensesByCategory.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No expense data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Income by Category Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Income by Category</CardTitle>
            <CardDescription>
              Breakdown of your income by source
            </CardDescription>
          </CardHeader>
          <CardContent>
            {incomeByCategory.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={incomeByCategory}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ category, percentage }) => `${formatCategoryName(category)} (${percentage}%)`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="totalAmount"
                  >
                    {incomeByCategory.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No income data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Income vs Expenses Over Time */}
      <Card>
        <CardHeader>
          <CardTitle>Income vs Expenses Over Time</CardTitle>
          <CardDescription>
            Daily comparison of your income and expenses
          </CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="income" 
                  stroke="#10B981" 
                  strokeWidth={2}
                  name="Income"
                />
                <Line 
                  type="monotone" 
                  dataKey="expenses" 
                  stroke="#EF4444" 
                  strokeWidth={2}
                  name="Expenses"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[400px] text-muted-foreground">
              No transaction data available for the selected period
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top Categories */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top Expense Categories</CardTitle>
            <CardDescription>
              Your highest spending categories
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {summary?.topExpenseCategories?.slice(0, 5).map((category, index) => (
                <div key={category.category} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="font-medium">
                      {formatCategoryName(category.category)}
                    </span>
                  </div>
                  <Badge variant="outline">
                    {formatCurrency(category.totalAmount)}
                  </Badge>
                </div>
              )) || (
                <p className="text-muted-foreground">No expense categories available</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Income Sources</CardTitle>
            <CardDescription>
              Your primary income sources
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {summary?.topIncomeCategories?.slice(0, 5).map((category, index) => (
                <div key={category.category} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="font-medium">
                      {formatCategoryName(category.category)}
                    </span>
                  </div>
                  <Badge variant="outline">
                    {formatCurrency(category.totalAmount)}
                  </Badge>
                </div>
              )) || (
                <p className="text-muted-foreground">No income categories available</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AnalyticsPage;


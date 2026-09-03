export type Paginated<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export type Store = {
  id: number;
  name: string;
  phone: string;
  address: string;
  account_number: string;
  currency: string;
  timezone: string;
};

export type Me = {
  user: { id: number; username: string; email: string; name: string };
  memberships: { id: number; role: string; store: Store }[];
};

export type Product = {
  id: number;
  name: string;
  sku: string;
  category: number | null;
  category_name: string | null;
  unit: string;
  purchase_price: string;
  selling_price: string;
  agent_selling_price: string;
  minimum_stock_threshold: string;
  current_quantity: string;
  is_low_stock: boolean;
  supplier: string;
  notes: string;
};

export type Category = { id: number; name: string; is_active: boolean };

export type Party = {
  id: number;
  party_type: 'trader' | 'agent';
  name: string;
  company: string;
  phone: string;
  account_number: string;
  address: string;
  notes: string;
  current_balance: string;
  balance_amount: string;
  balance_label: 'Owes Me' | 'I Owe' | 'Settled';
  balance_color: 'red' | 'green' | 'neutral';
  sms_enabled: boolean;
};

export type SaleItem = {
  id: number;
  product: number;
  product_name: string;
  sku: string;
  quantity: string;
  unit_price: string;
  line_total: string;
};

export type Sale = {
  id: string;
  customer_record_id: number | null;
  customer_name: string;
  customer_type: string;
  status: string;
  subtotal: string;
  total: string;
  amount_paid: string;
  outstanding: string;
  note: string;
  items: SaleItem[];
  created_by_name: string;
  created_at: string;
};

export type Payment = {
  id: string;
  party_record_id: number;
  party_name: string;
  amount: string;
  direction: 'received' | 'sent';
  payment_date: string;
  method: string;
  note: string;
  sale: string | null;
  purchase: string | null;
  balance_after: string;
  created_by_name: string;
  created_at: string;
};

export type Transaction = {
  id: number;
  created_at: string;
  party: number;
  party_name: string;
  party_type: string;
  transaction_type: string;
  description: string;
  sale_amount: string;
  payment_amount: string;
  credit_debit: 'credit' | 'debit';
  delta: string;
  running_balance: string;
  note: string;
};

export type Dashboard = {
  currency: string;
  today_sales: string;
  total_collected: string;
  customers_owing: string;
  store_payables: string;
  low_stock_count: number;
  today_transaction_count: number;
  today_expenses: string;
  month_expenses: string;
  monthly_budget: string;
  budget_remaining: string;
  budget_percentage: string;
  overdue_count: number;
  overdue_days: number;
  unread_notification_count: number;
  recent_transactions: Transaction[];
  today_transactions: Transaction[];
  low_stock: Product[];
  customers_owing_list: Party[];
  store_payables_list: Party[];
  recent_expenses: Expense[];
};

export type DashboardDetailKind = 'today_sales' | 'collected' | 'owes_me' | 'i_owe' | 'today_expenses' | 'month_expenses' | 'today_transactions';

export type DashboardDetail = {
  kind: DashboardDetailKind;
  title: string;
  subtitle: string;
  currency: string;
  period: { start: string; end: string };
  total: string | null;
  count: number;
  sales: Sale[];
  payments: Payment[];
  parties: Party[];
  expenses: Expense[];
};

export type ExpenseCategory = { id: number; name: string; color: string; is_active: boolean };

export type Expense = {
  id: string;
  category: number;
  category_name: string;
  amount: string;
  expense_date: string;
  payment_method: 'cash' | 'bank' | 'mobile' | 'credit' | 'other';
  description: string;
  reference: string;
  notes: string;
  is_reversed: boolean;
  reversed_at: string | null;
  created_by_name?: string;
  created_at: string;
};

export type ExpenseSummary = {
  period: { start: string; end: string };
  total: string;
  count: number;
  by_category: { category_id: number; category_name: string; color: string; amount: string; count: number }[];
  daily: { date: string; amount: string; count: number }[];
  current_month: { year: number; month: number; spent: string; budget: string; remaining: string; percentage: string };
};

export type PurchaseItem = { id: number; product: number; product_name: string; sku: string; quantity: string; unit_cost: string; line_total: string };

export type Purchase = {
  id: string;
  supplier_name: string;
  idempotency_key: string;
  status: string;
  purchase_date: string;
  total: string;
  amount_paid: string;
  outstanding: string;
  reference: string;
  note: string;
  items: PurchaseItem[];
  created_at: string;
};

export type OverdueParty = Party & { overdue_since: string; days_overdue: number };

export type SearchResults = {
  query: string;
  products: Product[];
  parties: Party[];
  sales: Sale[];
  purchases: Purchase[];
  expenses: Expense[];
};

export type Report = {
  id: number;
  report_type: string;
  period_start: string;
  period_end: string;
  version: number;
  summary: Record<string, unknown>;
  status: string;
  pdf_url: string | null;
  excel_url: string | null;
  created_at: string;
};

export type Notification = {
  id: number;
  notification_type: string;
  title: string;
  message: string;
  is_read: boolean;
  is_resolved: boolean;
  created_at: string;
};

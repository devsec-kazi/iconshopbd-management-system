import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  Timestamp, 
  getDocs, 
  where,
  doc,
  runTransaction,
  getDoc,
  deleteDoc,
  updateDoc
} from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestore-utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from './ui/table';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from './ui/dialog';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from './ui/select';
import { 
  Plus, 
  Trash2, 
  Download, 
  FileText, 
  Calculator, 
  User, 
  Store,
  Loader2,
  Search,
  ShoppingBag,
  CreditCard,
  Receipt,
  History,
  ArrowLeft,
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

// Extend jsPDF with autotable
declare module 'jsPDF' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

interface Customer {
  id: string;
  customerId: string;
  name: string;
  address: string;
  mobile: string;
  email: string;
  type?: 'VIP' | 'Regular';
  group?: string;
}

interface InvoiceItem {
  id: string;
  product: string;
  category: string;
  quantity: number | '';
  costPerProduct: number | '';
  total: number;
  details?: string;
}

interface Invoice {
  id: string;
  invoiceNo: string;
  customerId: string;
  customerName: string;
  customerType?: 'VIP' | 'Regular';
  date: Timestamp;
  orderDate?: string;
  deliveryDate?: string;
  items: Omit<InvoiceItem, 'id'>[];
  totalAmount: number;
  paymentMethod: string;
  advancePercentage?: number;
  advanceAmount?: number;
  dueAmount?: number;
  paymentStatus?: 'Paid' | 'Due';
}

const PRODUCT_CATEGORIES = [
  "Gown",
  "Hood",
  "Cap",
  "Sash",
  "Jute Bag",
  "Cap-Stole",
  "Gown-Cap",
  "Gown-Hood-Cap",
  "Gown-Cap-Stole",
  "Gown-Hood-Cap-Stole",
  "Crest",
  "Others"
];

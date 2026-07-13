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
declare module 'jspdf' {
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
  "jute bag",
  "Cap-Stole",
  "Gown-Cap",
  "Gown-Hood-Cap",
  "Gown-Cap-Stole",
  "Gown-Hood-Cap-Stole"
];

export function InvoiceGenerator({ 
  initialView = 'create',
  preSelectedCustomer = null,
  onClearPreSelected
}: { 
  initialView?: 'create' | 'history',
  preSelectedCustomer?: Customer | null,
  onClearPreSelected?: () => void
}) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [invoiceNo, setInvoiceNo] = useState('Loading...');
  const [orderDate, setOrderDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [deliveryDate, setDeliveryDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [items, setItems] = useState<InvoiceItem[]>([
    { id: '1', product: '', category: PRODUCT_CATEGORIES[0], quantity: '', costPerProduct: '', total: 0 }
  ]);
  const [loading, setLoading] = useState(false);
  const [isGeneratingNo, setIsGeneratingNo] = useState(true);
  const [view, setView] = useState<'create' | 'history'>(initialView);
  const [searchQuery, setSearchQuery] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerResults, setShowCustomerResults] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'VIP' | 'Regular'>('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<'all' | 'Paid' | 'Due'>('all');
  const [advancePercentage, setAdvancePercentage] = useState<number>(25);
  const [advanceMode, setAdvanceMode] = useState<'percent' | 'manual'>('percent');
  const [manualAdvanceAmount, setManualAdvanceAmount] = useState<number>(0);
  const [bkashNumber, setBkashNumber] = useState('01841546004');
  const [paymentInstructions, setPaymentInstructions] = useState("Please use 'Make Payment' option in your bKash app.");
  const [paymentNote, setPaymentNote] = useState('Thank you!');

  useEffect(() => {
    const fetchAppSettings = async () => {
      try {
        const settingsSnap = await getDoc(doc(db, 'settings', 'app'));
        if (settingsSnap.exists()) {
          const data = settingsSnap.data();
          setBkashNumber(data.bkashNumber || '01841546004');
          setPaymentInstructions(data.paymentInstructions || "Please use 'Make Payment' option in your bKash app.");
          setPaymentNote(data.paymentNote || 'Thank you!');
        }
      } catch (err) {
        console.error("Error fetching app settings:", err);
      }
    };
    fetchAppSettings();
  }, []);

  useEffect(() => {
    if (preSelectedCustomer) {
      setSelectedCustomerId(preSelectedCustomer.customerId);
      setCustomerSearch(preSelectedCustomer.name);
      onClearPreSelected?.();
    }
  }, [preSelectedCustomer]);

  // Close customer search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.customer-search-container')) {
        setShowCustomerResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setView(initialView);
  }, [initialView]);

  useEffect(() => {
    const qCustomers = query(collection(db, 'customers'), orderBy('createdAt', 'desc'));
    const unsubscribeCustomers = onSnapshot(qCustomers, (snapshot) => {
      const customerData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Customer[];
      setCustomers(customerData);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'customers');
    });

    const unsubscribeInvoices = onSnapshot(
      query(collection(db, 'invoices'), orderBy('date', 'desc')), 
      (snapshot) => {
        const invoiceData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Invoice[];
        setInvoices(invoiceData);
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'invoices');
      }
    );

    generateNextInvoiceNo();

    return () => {
      unsubscribeCustomers();
      unsubscribeInvoices();
    };
  }, []);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<string | null>(null);

  const generateNextInvoiceNo = async () => {
    setIsGeneratingNo(true);
    try {
      // Fetch settings for prefix
      const settingsRef = doc(db, 'settings', 'app');
      const settingsSnap = await getDoc(settingsRef);
      const prefix = settingsSnap.exists() ? settingsSnap.data().invoicePrefix : 'IF';
      
      const isVIP = selectedCustomer?.type === 'VIP';
      
      if (isVIP && selectedCustomer) {
        const folderName = selectedCustomer.name.toLowerCase().replace(/\s+/g, '-');
        const vipCounterRef = doc(db, 'vip_counters', folderName);
        const vipCounterSnap = await getDoc(vipCounterRef);
        
        let nextNo = 1;
        if (vipCounterSnap.exists()) {
          nextNo = vipCounterSnap.data().lastNo + 1;
        }
        
        setInvoiceNo(`${prefix}-VIP-${folderName}-${nextNo.toString().padStart(4, '0')}`);
      } else {
        const counterRef = doc(db, 'counters', 'invoices');
        const counterSnap = await getDoc(counterRef);
        
        let nextNo = 1;
        if (counterSnap.exists()) {
          nextNo = counterSnap.data().lastNo + 1;
        }
        
        setInvoiceNo(`${prefix}-${nextNo.toString().padStart(4, '0')}`);
      }
    } catch (error) {
      console.error("Error generating invoice no:", error);
      setInvoiceNo(`ICON-${Date.now().toString().slice(-4)}`);
    } finally {
      setIsGeneratingNo(false);
    }
  };

  useEffect(() => {
    if (selectedCustomerId) {
      generateNextInvoiceNo();
    }
  }, [selectedCustomerId]);

  const addItem = () => {
    const lastCategory = items.length > 0 ? items[items.length - 1].category : PRODUCT_CATEGORIES[0];
    setItems([...items, { 
      id: Date.now().toString(), 
      product: '', 
      category: lastCategory, 
      quantity: '', 
      costPerProduct: '', 
      total: 0 
    }]);
  };

  const removeItem = (id: string) => {
    if (items.length === 1) return;
    setItems(items.filter(item => item.id !== id));
  };

  const updateItem = (id: string, field: keyof InvoiceItem, value: string | number) => {
    setItems(items.map(item => {
      if (item.id === id) {
        let finalVal: any = value;
        if (field === 'quantity') {
          if (value === '') {
            finalVal = '';
          } else {
            const parsed = parseInt(String(value), 10);
            finalVal = isNaN(parsed) ? '' : parsed;
          }
        } else if (field === 'costPerProduct') {
          if (value === '') {
            finalVal = '';
          } else {
            const parsed = parseFloat(String(value));
            finalVal = isNaN(parsed) ? '' : parsed;
          }
        }
        const updatedItem = { ...item, [field]: finalVal };
        // Auto-calculate total safely as user types
        const qty = updatedItem.quantity === '' ? 0 : Number(updatedItem.quantity);
        const price = updatedItem.costPerProduct === '' ? 0 : Number(updatedItem.costPerProduct);
        updatedItem.total = qty * price;
        return updatedItem;
      }
      return item;
    }));
  };

  const totalAmount = items.reduce((sum, item) => sum + item.total, 0);

  const calculatedAdvanceAmount = advanceMode === 'percent'
    ? Math.round((totalAmount * advancePercentage) / 100)
    : manualAdvanceAmount;

  const calculatedDueAmount = Math.max(0, totalAmount - calculatedAdvanceAmount);

  const calculatedAdvancePercentage = advanceMode === 'percent'
    ? advancePercentage
    : (totalAmount > 0 ? Math.round((manualAdvanceAmount / totalAmount) * 100) : 0);

  const handleAdvanceModeChange = (mode: 'percent' | 'manual') => {
    setAdvanceMode(mode);
    if (mode === 'manual') {
      const currentCalculated = Math.round((totalAmount * advancePercentage) / 100);
      setManualAdvanceAmount(currentCalculated);
    } else {
      if (totalAmount > 0) {
        const calculatedPercentage = Math.round((manualAdvanceAmount / totalAmount) * 100);
        setAdvancePercentage(Math.min(100, Math.max(0, calculatedPercentage)));
      }
    }
  };

  const selectedCustomer = customers.find(c => c.customerId === selectedCustomerId);

  const handleDeleteInvoice = async () => {
    if (!invoiceToDelete) return;

    setLoading(true);
    try {
      await deleteDoc(doc(db, 'invoices', invoiceToDelete));
      toast.success("Invoice record deleted successfully");
      setIsDeleteModalOpen(false);
      setInvoiceToDelete(null);
    } catch (error) {
      console.error("Error deleting invoice:", error);
      toast.error("Failed to delete invoice");
    } finally {
      setLoading(false);
    }
  };

  const markAsPaid = async (id: string) => {
    try {
      await updateDoc(doc(db, 'invoices', id), {
        paymentStatus: 'Paid',
        dueAmount: 0
      });
      toast.success("Invoice marked as Paid");
    } catch (error) {
      console.error("Error updating invoice:", error);
      toast.error("Failed to update invoice");
    }
  };

  const generatePDF = async (invoiceData?: Invoice) => {
    const currentInvoiceNo = invoiceData ? invoiceData.invoiceNo : invoiceNo;
    const currentCustomer = invoiceData 
      ? customers.find(c => c.customerId === invoiceData.customerId) 
      : selectedCustomer;
    const currentItems = invoiceData ? invoiceData.items : items;
    const currentTotal = invoiceData ? invoiceData.totalAmount : totalAmount;
    const currentDate = invoiceData ? (invoiceData.date instanceof Timestamp ? invoiceData.date.toDate() : invoiceData.date) : new Date();

    if (!currentCustomer) {
      toast.error("Customer information missing");
      return false;
    }

    try {
      const pdfDoc = new jsPDF();
      
      // Fetch dynamic settings
      const settingsRef = doc(db, 'settings', 'app');
      const settingsSnap = await getDoc(settingsRef);
      const appSettings = settingsSnap.exists() ? settingsSnap.data() : {
        companyName: "Iconshopbd",
        companyAddress: "Dhaka, Bangladesh",
        bkashNumber: "01841546004",
        companyLogo: "",
        bkashLogo: ""
      };
      
      const companyName = appSettings.companyName;
      const companyAddress = appSettings.companyAddress;
      const bkashNumber = appSettings.bkashNumber;
      const companyLogo = appSettings.companyLogo;
      const bkashLogo = appSettings.bkashLogo;

      // Header - Clean Premium Corporate Theme
      // Top luxury royal blue accent line (2mm)
      pdfDoc.setFillColor(96, 165, 250); // Premium Soft Blue Accent (#60A5FA)
      pdfDoc.rect(0, 0, 210, 2, 'F');
      
      // Premium Royal Blue Background (from y=2 to y=42, height=40mm)
      pdfDoc.setFillColor(39, 70, 245); // Royal Blue (#2746F5)
      pdfDoc.rect(0, 2, 210, 40, 'F');
      
      // Calculate layout coordinates
      let brandX = 15;
      let contactX = 195; // Right margin
      
      // Let's check logo
      let hasLogo = false;

      if (companyLogo) {
        try {
          let format = 'PNG';
          if (companyLogo.includes('image/jpeg') || companyLogo.includes('image/jpg')) {
            format = 'JPEG';
          } else if (companyLogo.includes('image/webp')) {
            format = 'WEBP';
          }
          
          // Draw a luxurious white container for the factory logo with a delicate royal blue border
          pdfDoc.setFillColor(255, 255, 255);
          pdfDoc.setDrawColor(96, 165, 250); // Soft Blue border (#60A5FA)
          pdfDoc.setLineWidth(0.4);
          pdfDoc.roundedRect(14, 8, 28, 28, 1.5, 1.5, 'FD');
          
          let logoWidth = 22;
          let logoHeight = 22;
          let logoX = 17;
          let logoY = 11;
          
          try {
            // Resolve image dimensions to avoid cropping/stretching
            const img = await new Promise<HTMLImageElement>((resolve, reject) => {
              const tempImg = new Image();
              tempImg.onload = () => resolve(tempImg);
              tempImg.onerror = (e) => reject(e);
              tempImg.src = companyLogo;
            });
            
            const aspectRatio = img.width / img.height;
            if (aspectRatio > 1) {
              logoWidth = 22;
              logoHeight = 22 / aspectRatio;
              logoY = 8 + (28 - logoHeight) / 2;
              logoX = 14 + (28 - logoWidth) / 2;
            } else {
              logoHeight = 22;
              logoWidth = 22 * aspectRatio;
              logoX = 14 + (28 - logoWidth) / 2;
              logoY = 8 + (28 - logoHeight) / 2;
            }
          } catch (err) {
            console.error("Error loading logo image dimensions:", err);
          }
          
          pdfDoc.addImage(companyLogo, format, logoX, logoY, logoWidth, logoHeight);
          hasLogo = true;
          brandX = 49; // Move brand text to the right of the badge beautifully
        } catch (e) {
          console.error("Error adding logo to PDF:", e);
        }
      }

      // Brand Identity (Left Column) - Perfectly aligned vertically
      pdfDoc.setFont("helvetica", "bold");
      pdfDoc.setFontSize(22); // Elegant large size for brand name
      pdfDoc.setTextColor(255, 255, 255); // Pristine white
      pdfDoc.text(companyName.toUpperCase(), brandX, 18);
      
      // Factory Address
      pdfDoc.setFont("helvetica", "normal");
      pdfDoc.setFontSize(8.5);
      pdfDoc.setTextColor(226, 232, 240); // Soft lavender-slate
      pdfDoc.text(companyAddress, brandX, 25);
      pdfDoc.text(`Phone: ${bkashNumber}`, brandX, 30);
      
      // Specialty Area
      pdfDoc.setFont("helvetica", "normal");
      pdfDoc.setFontSize(7.5);
      pdfDoc.setTextColor(147, 197, 253); // Soft blue accent (#93C5FD)
      pdfDoc.text("Specialty: Bulk Apparel, Corporate Uniforms & Convocation Gowns", brandX, 35);

      // Contact Information (Right Column - Right Aligned) - Symmetrical to Left Column
      pdfDoc.setFont("helvetica", "bold");
      pdfDoc.setFontSize(9);
      pdfDoc.setTextColor(147, 197, 253); // Soft blue accent heading (#93C5FD)
      pdfDoc.text("CONTACT DETAILS", contactX, 18, { align: 'right' });
      
      pdfDoc.setFont("helvetica", "normal");
      pdfDoc.setFontSize(8.5);
      pdfDoc.setTextColor(226, 232, 240); // Soft lavender-slate
      pdfDoc.text(`Email: support@iconshopbd.com`, contactX, 24, { align: 'right' });
      pdfDoc.text(`Web: www.iconshopbd.com`, contactX, 28, { align: 'right' });
      pdfDoc.text(`Hotline: +88 01841-546004`, contactX, 32, { align: 'right' });
      
      pdfDoc.setFont("helvetica", "bold");
      pdfDoc.setFontSize(7.5);
      pdfDoc.setTextColor(147, 197, 253); // Soft blue highlight (#93C5FD)
      pdfDoc.text(`Status: Certified Manufacturer`, contactX, 36, { align: 'right' });

      // Clean horizontal divider under header
      pdfDoc.setDrawColor(96, 165, 250); // Soft blue border (#60A5FA)
      pdfDoc.setLineWidth(0.4);
      pdfDoc.line(15, 42, 195, 42);

      // Invoice Info Header (Left Column)
      pdfDoc.setTextColor(30, 41, 59); // Dark charcoal
      pdfDoc.setFontSize(20);
      pdfDoc.setFont("helvetica", "bold");
      pdfDoc.text("SALES MEMO", 15, 55);
      
      // Subtle accent line under SALES MEMO (span exactly across left column width 85)
      pdfDoc.setDrawColor(226, 232, 240);
      pdfDoc.setLineWidth(0.5);
      pdfDoc.line(15, 58, 100, 58);
      
      pdfDoc.setFontSize(8.5);
      pdfDoc.setFont("helvetica", "bold");
      pdfDoc.setTextColor(100, 116, 139);
      pdfDoc.text(`INVOICE NO:`, 15, 66);
      pdfDoc.setFont("helvetica", "bold");
      pdfDoc.setTextColor(30, 41, 59);
      pdfDoc.text(currentInvoiceNo, 46, 66);
      
      // Resolve Order Date
      const oDateRaw = invoiceData?.orderDate || orderDate || format(currentDate, 'yyyy-MM-dd');
      let oDateStr = oDateRaw;
      try {
        oDateStr = format(new Date(oDateRaw), 'PPP').toUpperCase();
      } catch (err) {
        console.error("Invalid order date", err);
      }

      pdfDoc.setFont("helvetica", "bold");
      pdfDoc.setTextColor(100, 116, 139);
      pdfDoc.text(`ORDER DATE:`, 15, 74);
      pdfDoc.setFont("helvetica", "normal");
      pdfDoc.setTextColor(71, 85, 105);
      pdfDoc.text(oDateStr, 46, 74);

      // Resolve Delivery Date
      const dDateRaw = invoiceData?.deliveryDate || deliveryDate || format(currentDate, 'yyyy-MM-dd');
      let dDateStr = dDateRaw;
      try {
        dDateStr = format(new Date(dDateRaw), 'PPP').toUpperCase();
      } catch (err) {
        console.error("Invalid delivery date", err);
      }

      pdfDoc.setFont("helvetica", "bold");
      pdfDoc.setTextColor(100, 116, 139);
      pdfDoc.text(`DELIVER DATE:`, 15, 82);
      pdfDoc.setFont("helvetica", "normal");
      pdfDoc.setTextColor(71, 85, 105);
      pdfDoc.text(dDateStr, 46, 82);
      
      const payStatus = invoiceData?.paymentStatus ?? 'Due';

      // PAID or DUE Stamp placed side-by-side with VIP Client Badge at y = 92
      if (payStatus === 'Paid') {
        pdfDoc.setDrawColor(34, 197, 94); // Green
        pdfDoc.setLineWidth(1);
        pdfDoc.roundedRect(15, 92, 36, 12, 1.5, 1.5, 'D');
        pdfDoc.setLineWidth(0.3);
        pdfDoc.roundedRect(16.5, 93.5, 33, 9, 1, 1, 'D');
        
        pdfDoc.setTextColor(34, 197, 94);
        pdfDoc.setFontSize(11);
        pdfDoc.setFont("helvetica", "bold");
        pdfDoc.text("PAID", 33, 100, { align: 'center' });
      } else {
        pdfDoc.setDrawColor(220, 38, 38); // Red
        pdfDoc.setLineWidth(1);
        pdfDoc.roundedRect(15, 92, 36, 12, 1.5, 1.5, 'D');
        pdfDoc.setLineWidth(0.3);
        pdfDoc.roundedRect(16.5, 93.5, 33, 9, 1, 1, 'D');
        
        pdfDoc.setTextColor(220, 38, 38);
        pdfDoc.setFontSize(11);
        pdfDoc.setFont("helvetica", "bold");
        pdfDoc.text("DUE", 33, 100, { align: 'center' });
      }

      if (currentCustomer?.type === 'VIP') {
        // VIP Badge with Icon placed side-by-side with PAID/DUE stamp at x = 55, y = 92
        pdfDoc.setFillColor(30, 41, 59); // Dark slate bg
        pdfDoc.roundedRect(55, 92, 40, 12, 1.5, 1.5, 'F');
        
        // Add a small star icon (drawn with lines)
        const starX = 61;
        const starY = 98;
        pdfDoc.setDrawColor(251, 191, 36); // Amber star color
        pdfDoc.setLineWidth(0.5);
        
        // Simple 5-point star
        pdfDoc.line(starX, starY - 2, starX + 0.8, starY + 1.8);
        pdfDoc.line(starX + 0.8, starY + 1.8, starX - 1.8, starY - 0.4);
        pdfDoc.line(starX - 1.8, starY - 0.4, starX + 1.8, starY - 0.4);
        pdfDoc.line(starX + 1.8, starY - 0.4, starX - 0.8, starY + 1.8);
        pdfDoc.line(starX - 0.8, starY + 1.8, starX, starY - 2);

        pdfDoc.setTextColor(255, 255, 255);
        pdfDoc.setFont("helvetica", "bold");
        pdfDoc.setFontSize(8.5);
        pdfDoc.text("VIP CLIENT", 78, 99.8, { align: 'center' });
      }

      // Customer Info Box - Right Column: Billing card at y = 48, width = 85, height = 56
      pdfDoc.setFillColor(248, 250, 252); // Soft gray/blue bg
      pdfDoc.roundedRect(110, 48, 85, 56, 2, 2, 'F');
      pdfDoc.setDrawColor(226, 232, 240); // Soft border
      pdfDoc.roundedRect(110, 48, 85, 56, 2, 2, 'D');
      
      pdfDoc.setFont("helvetica", "bold");
      pdfDoc.setFontSize(8.5);
      pdfDoc.setTextColor(79, 70, 229); // Primary theme color
      pdfDoc.text("BILLING TO", 116, 55);
      
      // Subtle billing header divider
      pdfDoc.setDrawColor(235, 239, 245);
      pdfDoc.line(116, 58, 189, 58);
      
      pdfDoc.setFontSize(11);
      pdfDoc.setTextColor(30, 41, 59); // Dark charcoal
      pdfDoc.text(currentCustomer?.name || "N/A", 116, 65);
      
      pdfDoc.setFontSize(8);
      pdfDoc.setFont("helvetica", "normal");
      pdfDoc.setTextColor(100, 116, 139);
      pdfDoc.text(`Client ID: ${currentCustomer?.customerId || "N/A"}`, 116, 71);
      pdfDoc.text(`Mobile: ${currentCustomer?.mobile || "N/A"}`, 116, 77);
      
      // Multi-line address wrapping safely
      const clientAddress = currentCustomer?.address || "No address provided";
      pdfDoc.setFont("helvetica", "normal");
      pdfDoc.setFontSize(8);
      pdfDoc.setTextColor(100, 116, 139);
      
      const addressLines = pdfDoc.splitTextToSize(clientAddress, 73); // 85 card width - 12 horizontal padding = 73 max width
      let addressY = 83;
      addressLines.slice(0, 3).forEach((line: string) => {
        pdfDoc.text(line, 116, addressY);
        addressY += 4.5;
      });

      // Table Data & Layout
      const tableData = currentItems.map(item => [
        item.product,
        item.category,
        item.quantity !== undefined && item.quantity !== '' ? item.quantity.toString() : '',
        item.costPerProduct !== undefined && item.costPerProduct !== '' ? item.costPerProduct.toLocaleString() : '',
        item.total ? item.total.toLocaleString() : '0'
      ]);

      autoTable(pdfDoc, {
        startY: 112,
        head: [['DESCRIPTION', 'CATEGORY', 'QTY', 'PRICE (BDT)', 'TOTAL (BDT)']],
        body: tableData,
        theme: 'grid',
        headStyles: { 
          fillColor: [79, 70, 229], // Majestic Indigo
          textColor: [255, 255, 255],
          fontSize: 9,
          fontStyle: 'bold',
          valign: 'middle',
          cellPadding: { top: 4, bottom: 4, left: 3, right: 3 }
        },
        bodyStyles: { 
          fontSize: 8.5,
          textColor: [30, 41, 59],
          valign: 'middle',
          cellPadding: { top: 3.5, bottom: 3.5, left: 3, right: 3 }
        },
        columnStyles: {
          0: { cellWidth: 85, halign: 'left' },
          1: { cellWidth: 20, halign: 'left' },
          2: { cellWidth: 12, halign: 'center' },
          3: { cellWidth: 30, halign: 'right' },
          4: { cellWidth: 33, halign: 'right', fontStyle: 'bold' }
        },
        margin: { left: 15, right: 15 },
        didDrawPage: (data) => {
          // Add custom footer on each page
          pdfDoc.setFontSize(8);
          pdfDoc.setTextColor(150, 150, 150);
          pdfDoc.text("Iconshopbd - Professional Invoice Memo", 105, 285, { align: 'center' });
        }
      });

      let finalY = (pdfDoc as any).lastAutoTable.finalY + 12;
      
      // Page break check for summary section (approx 45mm height needed)
      if (finalY > 210) {
        pdfDoc.addPage();
        finalY = 30; // Reset to top of new page
      }

      // Summary Section - Aligned perfectly with Right Column (x = 110, width = 85)
      pdfDoc.setFillColor(248, 250, 252); // Soft gray bg
      pdfDoc.roundedRect(110, finalY, 85, 34, 2, 2, 'F');
      pdfDoc.setDrawColor(226, 232, 240);
      pdfDoc.roundedRect(110, finalY, 85, 34, 2, 2, 'D');

      const advAmt = invoiceData?.advanceAmount !== undefined 
        ? invoiceData.advanceAmount 
        : (advanceMode === 'percent' 
            ? Math.round((currentTotal * advancePercentage) / 100) 
            : manualAdvanceAmount);

      const dueAmt = invoiceData?.dueAmount !== undefined 
        ? invoiceData.dueAmount 
        : Math.max(0, currentTotal - advAmt);

      const advPercentRepr = invoiceData?.advancePercentage !== undefined 
        ? invoiceData.advancePercentage 
        : (advanceMode === 'percent' 
            ? advancePercentage 
            : (currentTotal > 0 ? Math.round((manualAdvanceAmount / currentTotal) * 100) : 0));

      // Subtotal - Aligned to inner card padding
      pdfDoc.setFont("helvetica", "normal");
      pdfDoc.setFontSize(8.5);
      pdfDoc.setTextColor(100, 116, 139);
      pdfDoc.text("SUBTOTAL:", 116, finalY + 8);
      pdfDoc.setFont("helvetica", "bold");
      pdfDoc.setTextColor(30, 41, 59);
      pdfDoc.text(`${currentTotal.toLocaleString()} BDT`, 189, finalY + 8, { align: 'right' });

      // Advance
      pdfDoc.setFont("helvetica", "normal");
      pdfDoc.setTextColor(100, 116, 139);
      pdfDoc.text(`ADVANCE (${advPercentRepr}%):`, 116, finalY + 15);
      pdfDoc.setFont("helvetica", "bold");
      pdfDoc.setTextColor(30, 41, 59);
      pdfDoc.text(`${advAmt.toLocaleString()} BDT`, 189, finalY + 15, { align: 'right' });

      // Divider
      pdfDoc.setDrawColor(235, 239, 245);
      pdfDoc.setLineWidth(0.5);
      pdfDoc.line(116, finalY + 19, 189, finalY + 19);

      // Due Amount Highlighted Properly
      pdfDoc.setFont("helvetica", "bold");
      pdfDoc.setFontSize(10.5);
      if (payStatus === 'Paid') {
        pdfDoc.setTextColor(22, 163, 74); // Green
        pdfDoc.text("TOTAL PAID:", 116, finalY + 26);
        pdfDoc.text(`${currentTotal.toLocaleString()} BDT`, 189, finalY + 26, { align: 'right' });
      } else {
        pdfDoc.setTextColor(220, 38, 38); // Red
        pdfDoc.text("DUE AMOUNT:", 116, finalY + 26);
        pdfDoc.text(`${dueAmt.toLocaleString()} BDT`, 189, finalY + 26, { align: 'right' });
      }

      // Payment Information Header Block (Separated cleanly by 12mm below summary box)
      let paymentSectionY = finalY + 34 + 12;
      
      // Page break check for payment and footer section (needs approx 58mm)
      if (paymentSectionY > 215) {
        pdfDoc.addPage();
        paymentSectionY = 20; // Top of new page
      }

      // Section Title
      pdfDoc.setFont("helvetica", "bold");
      pdfDoc.setFontSize(12);
      pdfDoc.setTextColor(79, 70, 229); // Majestic Indigo Theme
      pdfDoc.text("PAYMENT INFORMATION", 15, paymentSectionY);
      
      // Thin line below section title
      pdfDoc.setDrawColor(226, 232, 240);
      pdfDoc.setLineWidth(0.5);
      pdfDoc.line(15, paymentSectionY + 3, 195, paymentSectionY + 3);

      const boxesY = paymentSectionY + 8;
      const boxHeight = 42;
      const boxWidth = 85;

      // --- LEFT COLUMN: bKash (Symmetrical card width & height) ---
      const leftBoxX = 15;
      pdfDoc.setFillColor(254, 242, 248); // Very light pink/bKash bg
      pdfDoc.roundedRect(leftBoxX, boxesY, boxWidth, boxHeight, 2.5, 2.5, 'F');
      pdfDoc.setDrawColor(251, 207, 232); // bKash border
      pdfDoc.roundedRect(leftBoxX, boxesY, boxWidth, boxHeight, 2.5, 2.5, 'D');

      // Title
      pdfDoc.setFont("helvetica", "bold");
      pdfDoc.setFontSize(10.5);
      pdfDoc.setTextColor(226, 19, 110); // bKash brand pink
      pdfDoc.text("bKash Payment Information", leftBoxX + 6, boxesY + 8);

      // Label
      pdfDoc.setFont("helvetica", "bold");
      pdfDoc.setFontSize(7.5);
      pdfDoc.setTextColor(120, 120, 120);
      pdfDoc.text("BKASH MERCHANT NUMBER", leftBoxX + 6, boxesY + 16);

      // Value
      pdfDoc.setFont("helvetica", "bold");
      pdfDoc.setFontSize(15);
      pdfDoc.setTextColor(226, 19, 110);
      pdfDoc.text(bkashNumber || "01841546004", leftBoxX + 6, boxesY + 24);

      // Instructions text
      pdfDoc.setFont("helvetica", "italic");
      pdfDoc.setFontSize(8);
      pdfDoc.setTextColor(100, 116, 139);
      pdfDoc.text("Use 'Make Payment' in your bKash app.", leftBoxX + 6, boxesY + 31);
      pdfDoc.text("Enter merchant bKash number and complete payment.", leftBoxX + 6, boxesY + 35.5);


      // --- RIGHT COLUMN: Bank (Symmetrical card width, height & baseline aligned) ---
      const rightBoxX = 110;
      pdfDoc.setFillColor(248, 250, 252); // Very light slate/blue bg
      pdfDoc.roundedRect(rightBoxX, boxesY, boxWidth, boxHeight, 2.5, 2.5, 'F');
      pdfDoc.setDrawColor(226, 232, 240); // Bank border
      pdfDoc.roundedRect(rightBoxX, boxesY, boxWidth, boxHeight, 2.5, 2.5, 'D');

      // Title
      pdfDoc.setFont("helvetica", "bold");
      pdfDoc.setFontSize(10.5);
      pdfDoc.setTextColor(79, 70, 229); // Majestic Indigo
      pdfDoc.text("Bank Transfer Information", rightBoxX + 6, boxesY + 8);

      // Labels & Values in clean tabular layout
      const bankLabels = ["BANK NAME:", "A/C NAME:", "A/C NUMBER:", "BRANCH:"];
      const bankValues = ["City Bank", "Icon Fashion", "1502893665001", "Pragati Sarani Branch"];
      
      let rowY = boxesY + 16;
      for (let i = 0; i < bankLabels.length; i++) {
        pdfDoc.setFont("helvetica", "bold");
        pdfDoc.setFontSize(7.5);
        pdfDoc.setTextColor(120, 120, 120);
        pdfDoc.text(bankLabels[i], rightBoxX + 6, rowY);
        
        pdfDoc.setFont("helvetica", "bold");
        pdfDoc.setFontSize(8);
        pdfDoc.setTextColor(30, 41, 59);
        pdfDoc.text(bankValues[i], rightBoxX + 28, rowY);
        rowY += 6.5;
      }

      // Footer divider - Sharp line with balanced spacing above footer
      const footerDividerY = boxesY + boxHeight + 12;
      pdfDoc.setDrawColor(226, 232, 240);
      pdfDoc.setLineWidth(0.4);
      pdfDoc.line(15, footerDividerY, 195, footerDividerY);
      
      // Footer text - Matched to Image
      pdfDoc.setTextColor(100, 116, 139);
      pdfDoc.setFontSize(11);
      pdfDoc.setFont("times", "italic");
      pdfDoc.text(paymentNote || "Thank you!", 15, footerDividerY + 8);
      
      pdfDoc.setFontSize(9);
      pdfDoc.setFont("courier", "normal");
      pdfDoc.text("www.iconshopbd.com", 195, footerDividerY + 8, { align: 'right' });

      // Bottom system watermark
      pdfDoc.setTextColor(150, 150, 150);
      pdfDoc.setFontSize(7.5);
      pdfDoc.setFont("helvetica", "normal");
      pdfDoc.text("Professionally generated by Iconshopbd Management System", 105, 287, { align: 'center' });

      // Save PDF
      const fileName = `${currentInvoiceNo}_${currentCustomer?.name || 'Invoice'}.pdf`;
      
      // Use a robust download method for both standard and restricted environments (iframes)
      try {
        const blob = pdfDoc.output('blob');
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Revoke the URL after a short delay to ensure the browser has started the download
        setTimeout(() => URL.revokeObjectURL(url), 100);
      } catch (e) {
        console.warn("Download failed, trying fallback:", e);
        pdfDoc.save(fileName);
      }

      return true;
    } catch (error) {
      console.error("PDF Generation Error:", error);
      toast.error("Failed to generate PDF. Check console for details.");
      return false;
    }
  };

  const saveInvoice = async () => {
    // 1. Validation
    if (!selectedCustomer) {
      toast.error("Please select a customer before saving.");
      const searchInput = document.querySelector('input[placeholder="Type Name or ID..."]') as HTMLInputElement;
      if (searchInput) searchInput.focus();
      return;
    }

    if (items.length === 0 || items.every(i => !i.product)) {
      toast.error("Please add at least one product with a description.");
      return;
    }

    if (totalAmount <= 0) {
      toast.error("Invoice total must be greater than 0 BDT.");
      return;
    }

    setLoading(true);
    
    const advAmt = advanceMode === 'percent' 
      ? Math.round((totalAmount * advancePercentage) / 100) 
      : manualAdvanceAmount;
    const dueAmt = Math.max(0, totalAmount - advAmt);
    const finalPercentage = advanceMode === 'percent'
      ? advancePercentage
      : (totalAmount > 0 ? Math.round((manualAdvanceAmount / totalAmount) * 100) : 0);

    // Create a backup of the data in case Firestore fails
    const invoiceBackup = {
      customerId: selectedCustomer.customerId,
      customerName: selectedCustomer.name,
      orderDate,
      deliveryDate,
      items: items.map(({ id, ...rest }) => ({
        ...rest,
        quantity: rest.quantity === '' ? 0 : Number(rest.quantity),
        costPerProduct: rest.costPerProduct === '' ? 0 : Number(rest.costPerProduct)
      })),
      totalAmount,
      advancePercentage: finalPercentage,
      advanceAmount: advAmt,
      dueAmount: dueAmt,
      date: new Date().toISOString(),
      status: 'pending_sync'
    };

    try {
      // 2. Fetch App Settings for Prefix
      let prefix = 'IF';
      let vipPrefix = '';
      try {
        const settingsRef = doc(db, 'settings', 'app');
        const settingsSnap = await getDoc(settingsRef);
        if (settingsSnap.exists()) {
          const appSettings = settingsSnap.data();
          prefix = appSettings.invoicePrefix || 'IF';
          vipPrefix = appSettings.vipFolderPrefix || '';
        }
      } catch (settingsError) {
        console.warn("Could not fetch settings, using defaults.", settingsError);
      }

      let finalInvoiceNo = '';
      const isVIP = selectedCustomer.type === 'VIP';
      const folderName = isVIP 
        ? (selectedCustomer.group || selectedCustomer.name).toLowerCase().replace(/\s+/g, '-') 
        : '';
      
      const counterRef = isVIP 
        ? doc(db, 'vip_counters', folderName)
        : doc(db, 'counters', 'invoices');

      // 3. Database Transaction
      await runTransaction(db, async (transaction) => {
        const counterSnap = await transaction.get(counterRef);
        let nextNo = 1;
        if (counterSnap.exists()) {
          nextNo = counterSnap.data().lastNo + 1;
        }
        
        finalInvoiceNo = isVIP 
          ? `${prefix}-VIP-${folderName}${vipPrefix ? '-' + vipPrefix : ''}-${nextNo.toString().padStart(4, '0')}`
          : `${prefix}-${nextNo.toString().padStart(4, '0')}`;
        
        const invoiceRef = doc(collection(db, 'invoices'));
        transaction.set(invoiceRef, {
          invoiceNo: finalInvoiceNo,
          customerId: selectedCustomer.customerId,
          customerName: selectedCustomer.name,
          customerType: selectedCustomer.type || 'Regular',
          date: Timestamp.now(),
          orderDate,
          deliveryDate,
          items: items.map(({ id, ...rest }) => ({
            ...rest,
            quantity: rest.quantity === '' ? 0 : Number(rest.quantity),
            costPerProduct: rest.costPerProduct === '' ? 0 : Number(rest.costPerProduct)
          })),
          totalAmount,
          paymentMethod: 'Bkash Merchant',
          advancePercentage: finalPercentage,
          advanceAmount: advAmt,
          dueAmount: dueAmt,
          paymentStatus: 'Due',
          createdAt: Timestamp.now()
        });
        
        transaction.set(counterRef, { lastNo: nextNo });
      });
      
      console.log(`Invoice ${finalInvoiceNo} saved successfully to Firestore.`);
      
      // 4. PDF Generation
      const pdfSuccess = await generatePDF({
        id: 'temp',
        invoiceNo: finalInvoiceNo,
        customerId: selectedCustomer.customerId,
        customerName: selectedCustomer.name,
        customerType: selectedCustomer.type || 'Regular',
        date: Timestamp.now(),
        orderDate,
        deliveryDate,
        items: items.map(({ id, ...rest }) => ({
          ...rest,
          quantity: rest.quantity === '' ? 0 : Number(rest.quantity),
          costPerProduct: rest.costPerProduct === '' ? 0 : Number(rest.costPerProduct)
        })),
        totalAmount,
        paymentMethod: 'Bkash Merchant',
        advancePercentage: finalPercentage,
        advanceAmount: advAmt,
        dueAmount: dueAmt,
        paymentStatus: 'Due'
      });

      if (pdfSuccess) {
        toast.success(`Invoice ${finalInvoiceNo} generated and saved!`);
        // Reset form
        setItems([{ id: Date.now().toString(), product: '', category: PRODUCT_CATEGORIES[0], quantity: '', costPerProduct: '', total: 0 }]);
        setSelectedCustomerId('');
        setCustomerSearch('');
        generateNextInvoiceNo();
        
        // Remove locally cached backup if exists
        localStorage.removeItem('last_invoice_draft');
      }
    } catch (error: any) {
      console.error("Critical error in saveInvoice:", error);
      
      // Local Fallback Storage
      try {
        localStorage.setItem('last_invoice_draft', JSON.stringify(invoiceBackup));
        toast.error("Database connection failed. Invoice saved locally in this browser.");
      } catch (e) {
        toast.error("Critical failure: Could not save to database or local storage.");
      }

      // More descriptive error messages based on Firebase error codes
      if (error.code === 'permission-denied') {
        toast.error("Security access denied. Please contact the administrator.");
      } else if (error.code === 'unavailable') {
        toast.error("Network offline or Firebase service unavailable.");
      } else {
        toast.error(`Save failed: ${error.message || 'Unknown error occurred'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch = inv.invoiceNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         inv.customerName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || 
                           inv.items.some(item => item.category === categoryFilter);
    const matchesType = typeFilter === 'all' || inv.customerType === typeFilter;
    const matchesStatus = paymentStatusFilter === 'all' || inv.paymentStatus === paymentStatusFilter;
    return matchesSearch && matchesCategory && matchesType && matchesStatus;
  });

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2 text-primary mb-2">
            <ShoppingBag className="h-5 w-5" />
            <span className="text-sm font-bold uppercase tracking-widest">Shop Mode</span>
          </div>
          <h2 className="text-4xl font-serif font-bold text-primary">
            {view === 'create' ? 'Invoice & Memo' : 'Invoice History'}
          </h2>
          <p className="text-muted-foreground mt-1">
            {view === 'create' 
              ? 'Create professional quotations and sales memos for your clients.' 
              : 'View and manage your past business transactions.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {view === 'create' && (
            <div className="bg-primary text-primary-foreground px-6 py-3 rounded-xl border border-border shadow-lg">
              <p className="text-[10px] uppercase tracking-tighter opacity-70">Current Serial</p>
              <p className="text-2xl font-sans font-bold">{isGeneratingNo ? '...' : invoiceNo}</p>
            </div>
          )}
        </div>
      </header>

      <AnimatePresence mode="wait">
        {view === 'create' ? (
          <motion.div 
            key="create"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-12 gap-8"
          >


            {/* Left Side: Items Selection */}
            <div className="col-span-12 lg:col-span-8 flex flex-col items-stretch">
              <Card className="border border-border shadow-xl bg-card overflow-hidden flex-1 flex flex-col rounded-3xl">
                <CardHeader className="bg-primary text-primary-foreground p-8">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-xl bg-white/10 flex items-center justify-center">
                        <Receipt className="h-7 w-7 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-2xl font-bold">Product Order</CardTitle>
                        <CardDescription className="text-white/60 text-sm">Detailed itemization for the client memo.</CardDescription>
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      onClick={addItem} 
                      className="h-12 bg-white/10 border-white/20 text-white hover:bg-white hover:text-primary transition-all font-bold px-6 rounded-xl"
                    >
                      <Plus className="mr-2 h-5 w-5" />
                      Add Item
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0 flex-1">
                  {/* Desktop view: visible on medium and larger screens */}
                  <div className="hidden md:block overflow-x-auto">
                    <Table className="w-full table-fixed min-w-[950px]">
                      <TableHeader>
                        <TableRow className="bg-muted hover:bg-muted border-b border-border">
                          <TableHead className="py-4 pl-8 pr-4 text-primary font-bold uppercase tracking-widest text-[9px] text-left">Description</TableHead>
                          <TableHead className="w-[150px] px-4 text-primary font-bold uppercase tracking-widest text-[9px] text-left">Category</TableHead>
                          <TableHead className="w-[90px] px-4 text-primary font-bold uppercase tracking-widest text-[9px] text-center">Qty</TableHead>
                          <TableHead className="w-[140px] px-4 text-primary font-bold uppercase tracking-widest text-[9px] text-left">Price (BDT)</TableHead>
                          <TableHead className="w-[140px] px-4 text-right text-primary font-bold uppercase tracking-widest text-[9px]">Total</TableHead>
                          <TableHead className="w-[70px] pl-4 pr-8"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((item) => (
                          <TableRow key={item.id} className="group hover:bg-muted/30 transition-colors border-b border-border last:border-0">
                            <TableCell className="pl-8 pr-4 py-4 align-middle">
                              <Input 
                                placeholder="Product name (e.g. Master Graduation Gown)..." 
                                value={item.product}
                                onChange={e => updateItem(item.id, 'product', e.target.value)}
                                className="h-10 text-xs border-border focus:border-primary focus:ring-primary/20 transition-all font-semibold rounded-lg shadow-sm bg-card w-full"
                              />
                            </TableCell>
                            <TableCell className="w-[150px] px-4 py-4 align-middle">
                              <Select 
                                value={item.category} 
                                onValueChange={val => updateItem(item.id, 'category', val)}
                              >
                                <SelectTrigger className="h-10 border-border text-xs rounded-lg font-medium focus:border-primary focus:ring-primary/20 transition-all shadow-sm bg-card w-full">
                                  <SelectValue placeholder="Category" />
                                </SelectTrigger>
                                <SelectContent>
                                  {PRODUCT_CATEGORIES.map(cat => (
                                    <SelectItem key={cat} value={cat} className="py-1.5 text-xs">{cat}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="w-[90px] px-4 py-4 align-middle">
                              <Input 
                                type="number" 
                                placeholder="0"
                                value={item.quantity === '' ? '' : item.quantity}
                                onChange={e => updateItem(item.id, 'quantity', e.target.value)}
                                className="h-10 border-border text-center font-bold text-xs rounded-lg focus:border-primary focus:ring-primary/20 transition-all shadow-sm bg-card w-full"
                              />
                            </TableCell>
                            <TableCell className="w-[140px] px-4 py-4 align-middle">
                              <div className="relative w-full">
                                <Input 
                                  type="number" 
                                  placeholder="0.00"
                                  value={item.costPerProduct === '' ? '' : item.costPerProduct}
                                  onChange={e => updateItem(item.id, 'costPerProduct', e.target.value)}
                                  className="h-10 border-border font-bold text-xs rounded-lg focus:border-primary focus:ring-primary/20 transition-all shadow-sm bg-card pr-8 w-full"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground/60 pointer-events-none">৳</span>
                              </div>
                            </TableCell>
                            <TableCell className="w-[140px] px-4 py-4 align-middle text-right">
                              <div className="h-10 flex items-center justify-end font-bold text-base text-primary font-sans w-full">
                                {item.total.toLocaleString()}
                              </div>
                            </TableCell>
                            <TableCell className="w-[70px] pl-4 pr-8 py-4 align-middle text-center">
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                onClick={() => removeItem(item.id)}
                                disabled={items.length === 1}
                                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all rounded-full disabled:opacity-30"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Mobile view: beautiful card layout hidden on desktop, perfectly balanced */}
                  <div className="block md:hidden p-4 space-y-4">
                    {items.map((item, index) => (
                      <div key={item.id} className="p-5 bg-muted/20 border border-border/80 rounded-2xl space-y-4 relative">
                        <div className="flex items-center justify-between pb-3 border-b border-border/60">
                          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest bg-stone-200/60 text-stone-700 px-3 py-1 rounded-full">Item #{index + 1}</span>
                          {items.length > 1 && (
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              onClick={() => removeItem(item.id)}
                              className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-full transition-all"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Product Description</Label>
                          <Input 
                            placeholder="Product name (e.g. Graduation Gown)..." 
                            value={item.product}
                            onChange={e => updateItem(item.id, 'product', e.target.value)}
                            className="h-10 text-xs border-border rounded-lg w-full font-semibold bg-card shadow-sm"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Category</Label>
                          <Select 
                            value={item.category} 
                            onValueChange={val => updateItem(item.id, 'category', val)}
                          >
                            <SelectTrigger className="h-10 border-border text-xs rounded-lg w-full bg-card shadow-sm">
                              <SelectValue placeholder="Category" />
                            </SelectTrigger>
                            <SelectContent>
                              {PRODUCT_CATEGORIES.map(cat => (
                                <SelectItem key={cat} value={cat} className="py-1.5 text-xs">{cat}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Qty</Label>
                            <Input 
                              type="number" 
                              placeholder="0"
                              value={item.quantity === '' ? '' : item.quantity}
                              onChange={e => updateItem(item.id, 'quantity', e.target.value)}
                              className="h-10 border-border text-center font-bold text-xs rounded-lg w-full bg-card shadow-sm"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Price (BDT)</Label>
                            <div className="relative">
                              <Input 
                                type="number" 
                                placeholder="0.00"
                                value={item.costPerProduct === '' ? '' : item.costPerProduct}
                                onChange={e => updateItem(item.id, 'costPerProduct', e.target.value)}
                                className="h-10 border-border font-bold text-xs rounded-lg w-full bg-card shadow-sm pr-7"
                              />
                              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground/60 pointer-events-none">৳</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-border/40">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Total</span>
                          <span className="text-base font-sans font-black text-primary">
                            {item.total.toLocaleString()} BDT
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Side: Customer & Summary */}
            <div className="col-span-12 lg:col-span-4 flex flex-col items-stretch">
              <Card className="border border-border shadow-2xl bg-card overflow-hidden flex-1 flex flex-col rounded-3xl">
                <CardHeader className="border-b border-border p-8">
                  <div className="flex items-center gap-3 text-primary">
                    <User className="h-6 w-6" />
                    <CardTitle className="text-2xl font-sans font-bold">Customer & Summary</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-8 space-y-8 flex-1">
                  {/* Invoice Details & Dates Block */}
                  <div className="bg-muted p-6 rounded-2xl border border-border space-y-4 shadow-inner">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-primary uppercase tracking-widest">Invoice Details</p>
                      <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-tighter bg-card">Active Session</Badge>
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-muted-foreground uppercase text-[10px] font-bold tracking-wider">Invoice Serial No</Label>
                      <div className="h-12 px-4 rounded-xl border border-border bg-card flex items-center justify-between shadow-sm">
                        <span className="font-mono font-bold text-primary text-sm">{isGeneratingNo ? '...' : invoiceNo}</span>
                        <Badge className="text-[9px] font-bold uppercase tracking-tighter bg-primary/10 text-primary border-primary/20">Auto-generated</Badge>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="order-date" className="text-muted-foreground uppercase text-[10px] font-bold tracking-wider">Order Date</Label>
                        <Input
                          id="order-date"
                          type="date"
                          value={orderDate}
                          onChange={e => setOrderDate(e.target.value)}
                          className="h-12 border-border text-sm font-medium rounded-xl shadow-sm focus:ring-primary/10 w-full bg-card"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="delivery-date" className="text-muted-foreground uppercase text-[10px] font-bold tracking-wider">Delivery Date</Label>
                        <Input
                          id="delivery-date"
                          type="date"
                          value={deliveryDate}
                          onChange={e => setDeliveryDate(e.target.value)}
                          className="h-12 border-border text-sm font-medium rounded-xl shadow-sm focus:ring-primary/10 w-full bg-card"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 relative customer-search-container">
                    <Label className="text-muted-foreground uppercase text-[10px] font-bold tracking-[0.2em]">Search Client (Name or ID)</Label>
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <Input 
                        placeholder="Type Name or ID..." 
                        value={customerSearch}
                        onChange={e => {
                          setCustomerSearch(e.target.value);
                          setShowCustomerResults(true);
                        }}
                        onFocus={() => setShowCustomerResults(true)}
                        className="pl-12 h-16 border-border text-lg font-medium rounded-2xl shadow-sm focus:ring-primary/10"
                      />
                    </div>

                    <AnimatePresence>
                      {showCustomerResults && (
                        <motion.div 
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="absolute z-50 left-0 right-0 mt-2 bg-card rounded-2xl shadow-2xl border border-border max-h-80 overflow-y-auto"
                        >
                          {customers
                            .filter(c => {
                              if (!customerSearch) return true;
                              const search = customerSearch.toLowerCase();
                              return (
                                (c.name?.toLowerCase() || '').includes(search) || 
                                (c.customerId?.toLowerCase() || '').includes(search) ||
                                (c.mobile?.toLowerCase() || '').includes(search)
                              );
                            })
                            .map(c => (
                              <button
                                key={c.id}
                                onClick={() => {
                                  setSelectedCustomerId(c.customerId);
                                  setCustomerSearch(c.name);
                                  setShowCustomerResults(false);
                                }}
                                className="w-full text-left px-6 py-4 hover:bg-muted transition-colors border-b border-muted last:border-0 flex items-center justify-between group"
                              >
                                <div>
                                  <p className="font-bold text-primary group-hover:text-primary transition-colors text-lg">{c.name}</p>
                                  <p className="text-sm text-muted-foreground">{c.customerId} • {c.mobile}</p>
                                </div>
                                {c.type === 'VIP' && (
                                  <Badge className="bg-primary text-primary-foreground border-primary font-bold">VIP</Badge>
                                )}
                              </button>
                            ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {selectedCustomer && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="p-6 rounded-2xl bg-muted border border-border space-y-4 shadow-inner"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-primary uppercase tracking-widest">Client Details</p>
                        <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-tighter bg-card">Verified Account</Badge>
                      </div>
                      
                      <div className="grid grid-cols-1 gap-3">
                        <div className="bg-card p-4 rounded-xl border border-border shadow-sm">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter mb-1">Full Name</p>
                          <p className="text-lg font-sans font-bold text-primary">{selectedCustomer.name}</p>
                        </div>
                        
                        <div className="bg-card p-4 rounded-xl border border-border shadow-sm">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter mb-1">Mobile Number</p>
                          <p className="text-lg font-sans font-bold text-primary">{selectedCustomer.mobile || 'N/A'}</p>
                        </div>
 
                        <div className="bg-card p-4 rounded-xl border border-border shadow-sm">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter mb-1">Billing Address</p>
                          <p className="text-sm text-primary leading-relaxed">{selectedCustomer.address || 'No address provided'}</p>
                        </div>
                      </div>
                    </motion.div>
                  )}

                    <div className="pt-8 border-t border-border space-y-6">
                      <div className="grid grid-cols-1 gap-4">
                        <div className="flex items-center justify-between bg-muted p-5 rounded-2xl border border-border shadow-sm">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-card flex items-center justify-center">
                              <Calculator className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Subtotal</p>
                              <p className="text-lg font-sans font-bold text-primary">{totalAmount.toLocaleString()} BDT</p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="bg-muted p-5 rounded-2xl border border-border shadow-sm space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center">
                                <CreditCard className="h-5 w-5" />
                              </div>
                              <div>
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                  Advance ({calculatedAdvancePercentage}%)
                                </p>
                                <p className="text-lg font-sans font-bold text-primary">
                                  {calculatedAdvanceAmount.toLocaleString()} BDT
                                </p>
                              </div>
                            </div>

                            {/* Manual Advance Toggle Control */}
                            <div className="flex bg-stone-200/80 p-0.5 rounded-lg border border-stone-300 shadow-sm shrink-0">
                              <button
                                type="button"
                                onClick={() => handleAdvanceModeChange('percent')}
                                className={cn(
                                  "px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded transition-all duration-200",
                                  advanceMode === 'percent' ? "bg-primary text-primary-foreground shadow-sm font-bold" : "text-muted-foreground hover:text-primary"
                                )}
                              >
                                %
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAdvanceModeChange('manual')}
                                className={cn(
                                  "px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded transition-all duration-200",
                                  advanceMode === 'manual' ? "bg-primary text-primary-foreground shadow-sm font-bold" : "text-muted-foreground hover:text-primary"
                                )}
                              >
                                BDT
                              </button>
                            </div>
                          </div>

                          {advanceMode === 'percent' ? (
                            <div className="space-y-1.5">
                              <div className="flex justify-between text-[10px] font-bold text-muted-foreground uppercase px-0.5">
                                <span>Adjust percentage</span>
                                <span className="text-primary font-sans">{advancePercentage}%</span>
                              </div>
                              <div className="px-2 pb-1">
                                <Input 
                                  type="range" 
                                  min="0" 
                                  max="100" 
                                  step="5"
                                  value={advancePercentage}
                                  onChange={e => setAdvancePercentage(parseInt(e.target.value))}
                                  className="h-2 bg-stone-200 accent-primary cursor-pointer w-full"
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              <div className="flex justify-between text-[10px] font-bold text-muted-foreground uppercase px-0.5">
                                <span>Enter Manual Amount</span>
                                <span className="text-primary font-sans text-[10px]">{calculatedAdvancePercentage}% equivalent</span>
                              </div>
                              <div className="relative">
                                <Input 
                                  type="number"
                                  min="0"
                                  max={totalAmount}
                                  placeholder="0"
                                  value={manualAdvanceAmount || ''}
                                  onChange={e => {
                                    const val = parseInt(e.target.value) || 0;
                                    setManualAdvanceAmount(Math.min(totalAmount, val));
                                  }}
                                  className="h-9 border-border bg-card pr-12 text-xs font-bold text-primary focus:border-primary focus:ring-primary/20 transition-all rounded-md font-sans"
                                />
                                <span className="absolute inset-y-0 right-3 flex items-center text-[10px] font-black text-muted-foreground tracking-widest uppercase pointer-events-none">BDT</span>
                              </div>
                            </div>
                          )}
                        </div>
                      {/* Enhanced Financial Status Visibility */}
                      <div className="p-6 rounded-3xl bg-card text-card-foreground shadow-xl relative overflow-hidden border border-border group">
                        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none group-hover:scale-110 transition-transform duration-700">
                          <Sparkles className="h-24 w-24" />
                        </div>
                        
                        <div className="relative z-10 space-y-6">
                          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-primary border-b border-primary/10 pb-2 inline-block">Order Valuation</p>
                          
                          <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 rounded-xl bg-success/5 border border-success/10">
                              <div className="flex items-center gap-3">
                                <CreditCard className="h-5 w-5 text-success" />
                                <span className="text-xs font-bold text-success uppercase tracking-widest">Paid Total</span>
                              </div>
                              <span className="text-xl font-sans font-black text-success tabular-nums">
                                {calculatedAdvanceAmount.toLocaleString()} <span className="text-[10px] font-normal opacity-60">BDT</span>
                              </span>
                            </div>

                            <div className="flex flex-col gap-2 p-5 rounded-2xl bg-destructive text-destructive-foreground shadow-lg shadow-destructive/20 relative overflow-hidden">
                              <div className="flex items-center justify-between relative z-10">
                                <div className="flex items-center gap-3">
                                  <AlertCircle className="h-6 w-6 text-white" />
                                  <span className="text-sm font-black uppercase tracking-[0.1em]">Due Balance</span>
                                </div>
                                <span className="text-3xl font-sans font-black tracking-tighter tabular-nums text-white">
                                  {calculatedDueAmount.toLocaleString()} <span className="text-xs font-normal opacity-70">BDT</span>
                                </span>
                              </div>
                              <p className="text-[10px] font-bold uppercase tracking-widest opacity-60 relative z-10 text-right">Pending at delivery</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                      <Button 
                        onClick={saveInvoice}
                        disabled={loading || !selectedCustomerId}
                        className={cn(
                          "w-full h-24 rounded-[2rem] text-lg font-serif font-bold shadow-2xl transition-all active:scale-[0.98] disabled:opacity-50 group relative overflow-hidden",
                          loading ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground hover:bg-primary/90"
                        )}
                      >
                        <div className="relative z-10 flex items-center justify-center gap-4">
                          {loading ? (
                            <Loader2 className="h-8 w-8 animate-spin" />
                          ) : (
                            <>
                              <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <FileText className="h-7 w-7" />
                              </div>
                              <div className="flex flex-col items-start">
                                <span className="leading-none">Generate Memo</span>
                                <span className="text-[10px] font-sans uppercase tracking-[0.2em] opacity-60 mt-1">Save & Download PDF</span>
                              </div>
                            </>
                          )}
                        </div>
                        {!loading && (
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                        )}
                      </Button>
                    </div>
                </CardContent>
              </Card>
            </div>

            {/* Payment Information Card */}
            <div className="col-span-12 mt-4">
              <div className="bg-white rounded-[2rem] p-8 md:p-10 shadow-xl border border-border space-y-6 relative overflow-hidden group">
                <div className="border-b border-border pb-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-bold text-primary uppercase tracking-wider flex items-center gap-2">
                      <CreditCard className="h-5 w-5 text-primary" />
                      Payment Information
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">Please use either bKash or Bank details below to make payments.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                      <Sparkles className="h-4 w-4 text-primary" />
                    </div>
                    <span className="text-xs font-bold text-primary uppercase tracking-wider">Secure Payment</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left Column: bKash Payment Information */}
                  <div className="bg-[#E2136E]/5 rounded-[1.5rem] p-6 border border-[#E2136E]/15 relative overflow-hidden flex flex-col justify-between">
                    <div className="absolute top-4 right-4 text-[#E2136E]/10">
                      <div className="w-10 h-10 bg-[#E2136E] rounded-full flex items-center justify-center">
                        <span className="text-white text-xl font-black italic">b</span>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-[#E2136E] font-bold text-base font-sans">bKash Payment Information</h4>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Mobile Merchant Account</p>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white p-4 rounded-xl border border-[#E2136E]/10 shadow-sm flex flex-col justify-between min-h-[5.5rem] gap-1 col-span-2">
                          <span className="text-[9px] uppercase tracking-wider text-[#E2136E]/60 font-semibold">bKash Merchant Number</span>
                          <span className="text-xl md:text-2xl font-sans font-black text-[#E2136E] tracking-tight tabular-nums">{bkashNumber}</span>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-[#E2136E]/10 shadow-sm flex flex-col justify-center min-h-[5.5rem] gap-1 col-span-2">
                          <span className="text-[9px] uppercase tracking-wider text-[#E2136E]/60 font-semibold mb-1">Payment Instructions</span>
                          <span className="text-xs text-muted-foreground italic leading-snug">{paymentInstructions}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Bank Information */}
                  <div className="bg-primary/5 rounded-[1.5rem] p-6 border border-primary/10 relative overflow-hidden flex flex-col justify-between">
                    <div className="absolute top-4 right-4 text-primary/10">
                      <Store className="h-10 w-10" />
                    </div>
                    
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-primary font-bold text-base font-sans">Bank Information</h4>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Corporate Bank Account</p>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white p-3 rounded-xl border border-primary/10 shadow-sm flex flex-col justify-between min-h-[5.5rem] gap-1">
                          <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Bank Name</span>
                          <span className="font-bold text-primary text-xs break-words leading-snug">City Bank</span>
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-primary/10 shadow-sm flex flex-col justify-between min-h-[5.5rem] gap-1">
                          <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Account Name</span>
                          <span className="font-bold text-primary text-xs break-words leading-snug">Icon Fashion</span>
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-primary/10 shadow-sm flex flex-col justify-between min-h-[5.5rem] gap-1">
                          <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Account No</span>
                          <span className="font-bold text-primary text-xs font-mono break-all leading-snug">1502893665001</span>
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-primary/10 shadow-sm flex flex-col justify-between min-h-[5.5rem] gap-1">
                          <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Branch</span>
                          <span className="font-semibold text-primary text-[10px] leading-tight break-words">Pragati Sarani Branch</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-border flex flex-col md:flex-row items-center justify-between gap-2">
                  <p className="text-base font-serif italic text-primary">{paymentNote || "Thank you!"}</p>
                  <p className="text-[10px] md:text-xs font-mono text-muted-foreground tracking-widest uppercase">www.iconshopbd.com</p>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="history"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <Card className="border border-border shadow-xl bg-card overflow-hidden">
              <CardHeader className="bg-primary text-primary-foreground p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <History className="h-6 w-6" />
                    <CardTitle className="text-2xl font-sans font-bold">Past Invoices</CardTitle>
                  </div>
                  <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
                    <div className="relative w-full md:w-72">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary-foreground/60" />
                      <Input 
                        placeholder="Search Invoice or Customer..." 
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="pl-10 h-12 bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground placeholder:text-primary-foreground/40 focus:bg-primary-foreground/20"
                      />
                    </div>
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                      <SelectTrigger className="h-12 w-full md:w-48 bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground focus:bg-primary-foreground/20">
                        <SelectValue placeholder="Filter Category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {PRODUCT_CATEGORIES.map(cat => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={typeFilter} onValueChange={(val: any) => setTypeFilter(val)}>
                      <SelectTrigger className="h-12 w-full md:w-40 bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground focus:bg-primary-foreground/20">
                        <SelectValue placeholder="Client Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Clients</SelectItem>
                        <SelectItem value="Regular">Regular Only</SelectItem>
                        <SelectItem value="VIP">VIP (Folder A)</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={paymentStatusFilter} onValueChange={(val: any) => setPaymentStatusFilter(val)}>
                      <SelectTrigger className="h-12 w-full md:w-40 bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground focus:bg-primary-foreground/20">
                        <SelectValue placeholder="Payment Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="Paid">Paid</SelectItem>
                        <SelectItem value="Due">Due</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table className="min-w-[800px]">
                  <TableHeader>
                    <TableRow className="bg-muted">
                      <TableHead className="py-6 px-6 font-bold text-primary">Invoice No</TableHead>
                      <TableHead className="font-bold text-primary">Customer</TableHead>
                      <TableHead className="font-bold text-primary">Date</TableHead>
                      <TableHead className="font-bold text-primary">Amount</TableHead>
                      <TableHead className="font-bold text-primary">Items</TableHead>
                      <TableHead className="text-right px-6 font-bold text-primary">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInvoices.length > 0 ? (
                      filteredInvoices.map((inv) => (
                        <TableRow key={inv.id} className="hover:bg-muted transition-colors">
                          <TableCell className="px-6 py-4 font-sans font-bold text-primary">
                            <div className="flex flex-col">
                              <span>{inv.invoiceNo}</span>
                              {inv.customerType === 'VIP' && (
                                <span className="text-[8px] text-primary font-bold uppercase tracking-tighter">VIP Folder A</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-primary">{inv.customerName}</TableCell>
                          <TableCell className="text-primary">{format(inv.date.toDate(), 'PPP')}</TableCell>
                          <TableCell className="font-bold text-primary">{inv.totalAmount.toLocaleString()} BDT</TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <span className="px-2 py-1 rounded-full bg-muted text-[10px] font-bold text-primary uppercase w-fit">
                                {inv.items.length} {inv.items.length === 1 ? 'Item' : 'Items'}
                              </span>
                              <span className={cn(
                                "px-2 py-1 rounded-full text-[10px] font-bold uppercase w-fit",
                                inv.paymentStatus === 'Paid' 
                                  ? "bg-green-100 text-green-700 border border-green-200" 
                                  : "bg-red-100 text-red-700 border border-red-200"
                              )}>
                                {inv.paymentStatus === 'Paid' ? 'Paid' : `Due: ${inv.dueAmount?.toLocaleString()} BDT`}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right px-6">
                            <div className="flex justify-end gap-2">
                              {inv.paymentStatus !== 'Paid' && (
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={() => markAsPaid(inv.id)}
                                  className="border-primary text-primary hover:bg-muted font-bold"
                                >
                                  Mark Paid
                                </Button>
                              )}
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={async () => await generatePDF(inv)}
                                className="text-primary hover:text-primary hover:bg-primary/10 font-bold"
                              >
                                <Download className="mr-2 h-4 w-4" />
                                Download PDF
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => {
                                  setInvoiceToDelete(inv.id);
                                  setIsDeleteModalOpen(true);
                                }}
                                className="h-10 w-10 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                              >
                                <Trash2 className="h-5 w-5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                          No invoices found matching your search.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent className="sm:max-w-[400px] border-none shadow-2xl p-0 overflow-hidden">
          <div className="bg-destructive p-8 text-white">
            <DialogHeader>
              <DialogTitle className="text-2xl font-serif">Confirm Deletion</DialogTitle>
              <CardDescription className="text-white/70">
                This action is permanent and will remove the invoice record from your history forever.
              </CardDescription>
            </DialogHeader>
          </div>
          <div className="p-8 flex flex-col gap-4 bg-white">
            <p className="text-muted-foreground text-sm">Are you absolutely sure you want to delete this invoice record?</p>
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                onClick={() => setIsDeleteModalOpen(false)}
                className="flex-1 h-12 rounded-xl border-border"
              >
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleDeleteInvoice}
                disabled={loading}
                className="flex-1 h-12 rounded-xl bg-destructive font-bold"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Yes, Delete"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

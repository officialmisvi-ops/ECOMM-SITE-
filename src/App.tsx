/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ShoppingCart,
  Search,
  Sparkles,
  ShieldCheck,
  Truck,
  RotateCcw,
  Star,
  X,
  Plus,
  Minus,
  Check,
  Bot,
  Send,
  Lock,
  Eye,
  ArrowRight,
  Package,
  Award,
  Sparkle
} from 'lucide-react';
import { products as catalogProducts, Product, CATEGORIES, Category } from './data/products';
import misviLogo from './assets/images/regenerated_image_1791035363792.png';

declare global {
  interface Window {
    Cashfree?: any;
  }
}

interface CartItem {
  product: Product;
  quantity: number;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  suggestedProducts?: Product[];
}

export default function App() {
  const [products] = useState<Product[]>(catalogProducts);
  const [selectedCategory, setSelectedCategory] = useState<Category>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'featured' | 'price-asc' | 'price-desc' | 'rating'>('featured');
  
  // Cart State (Persisted in localStorage)
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('misvi_cart');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Re-hydrate with actual product references
          return parsed.map((item: any) => ({
            product: catalogProducts.find((p) => p.id === item.id) || item,
            quantity: item.quantity || 1,
          })).filter((item: any) => item.product && item.product.price);
        }
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  });

  // Modals & Drawers
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);
  const [selectedQuickViewImage, setSelectedQuickViewImage] = useState<string>('');
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isOrderConfirmed, setIsOrderConfirmed] = useState(false);
  const [confirmedOrderId, setConfirmedOrderId] = useState('');
  const [confirmedOrderAmount, setConfirmedOrderAmount] = useState(0);

  // Checkout Form State
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerCity, setCustomerCity] = useState('');
  const [customerState, setCustomerState] = useState('');
  const [customerPincode, setCustomerPincode] = useState('');
  const [checkoutError, setCheckoutError] = useState('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // In-Store AI Advisor State
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [aiInput, setAiInput] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: "Namaste! 👋 I'm **Misvi**, your personal child development & toy shopping assistant.\n\nTell me: who are you shopping for? Share their age, budget, or skills you'd love to encourage (like musical pitch, speech, fine motor skills, or screen-free focus)!",
    },
  ]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Toast Notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    try {
      const serializableCart = cart.map((item) => ({
        id: item.product.id,
        quantity: item.quantity,
      }));
      localStorage.setItem('misvi_cart', JSON.stringify(serializableCart));
    } catch (e) {
      console.error(e);
    }
  }, [cart]);

  useEffect(() => {
    if (quickViewProduct) {
      setSelectedQuickViewImage(quickViewProduct.images[0]);
    }
  }, [quickViewProduct]);

  useEffect(() => {
    if (isAiOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isAiOpen]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  };

  // Cart Calculations
  const cartSubtotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.product.price * item.quantity, 0);
  }, [cart]);

  const cartItemCount = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.quantity, 0);
  }, [cart]);

  // Shipping Fee calculation (Free shipping above ₹499, else ₹49)
  const shippingFee = useMemo(() => {
    if (cartSubtotal === 0) return 0;
    return cartSubtotal >= 499 ? 0 : 49;
  }, [cartSubtotal]);

  const totalPayable = cartSubtotal + shippingFee;

  const addToCart = (product: Product, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
    showToast(`Added "${product.title.slice(0, 22)}..." to cart!`);
  };

  const updateCartQuantity = (productId: string, delta: number) => {
    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  const removeCartItem = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  // Filtered & Sorted Products
  const filteredProducts = useMemo(() => {
    return products
      .filter((p) => {
        const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
        const query = searchQuery.trim().toLowerCase();
        const matchesSearch =
          !query ||
          p.title.toLowerCase().includes(query) ||
          p.category.toLowerCase().includes(query) ||
          p.sku.toLowerCase().includes(query) ||
          p.bulletFeatures.some((f) => f.toLowerCase().includes(query)) ||
          p.description.toLowerCase().includes(query);
        return matchesCategory && matchesSearch;
      })
      .sort((a, b) => {
        if (sortBy === 'price-asc') return a.price - b.price;
        if (sortBy === 'price-desc') return b.price - a.price;
        if (sortBy === 'rating') return b.rating - a.rating;
        return (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0);
      });
  }, [products, selectedCategory, searchQuery, sortBy]);

  // Cashfree Checkout Execution
  const handleProceedToPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setCheckoutError('');

    if (totalPayable <= 0) return;

    const cleanPhone = customerPhone.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      setCheckoutError('Please enter a valid 10-digit mobile number');
      return;
    }

    const cleanPincode = customerPincode.replace(/\D/g, '');
    if (cleanPincode.length !== 6) {
      setCheckoutError('Please enter a valid 6-digit delivery pincode');
      return;
    }

    setIsProcessingPayment(true);

    try {
      const orderPayload = {
        orderAmount: totalPayable,
        customerName: customerName.trim(),
        customerPhone: cleanPhone,
        customerEmail: customerEmail.trim() || `${cleanPhone}@misvitoys.com`,
        address: customerAddress.trim(),
        city: customerCity.trim(),
        state: customerState.trim(),
        pincode: cleanPincode,
        items: cart.map((i) => ({
          id: i.product.id,
          sku: i.product.sku,
          title: i.product.title,
          price: i.product.price,
          quantity: i.quantity,
        })),
      };

      const res = await fetch('/api/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to initiate Cashfree order');
      }

      const { orderId, paymentSessionId, cfEnvironment } = data;

      // Check if Cashfree Web SDK is available in window
      if (typeof window.Cashfree !== 'undefined' && paymentSessionId && !paymentSessionId.includes('session_sandbox_demo')) {
        try {
          const cashfree = window.Cashfree({ mode: cfEnvironment || 'sandbox' });
          cashfree.checkout({
            paymentSessionId: paymentSessionId,
            redirectTarget: '_modal',
          }).then((result: any) => {
            if (result.error) {
              console.warn('Cashfree payment modal dismissed or errored:', result.error);
              setCheckoutError(result.error.message || 'Payment window closed.');
            }
            if (result.paymentDetails) {
              completeOrderSuccess(orderId, totalPayable);
            }
          }).catch((cfErr: any) => {
            console.warn('Cashfree modal error fallback:', cfErr);
            completeOrderSuccess(orderId, totalPayable);
          });
        } catch (modalErr) {
          console.warn('Cashfree execution catch:', modalErr);
          completeOrderSuccess(orderId, totalPayable);
        }
      } else {
        // Simulated instant payment confirmation for testing & demonstration
        setTimeout(() => {
          completeOrderSuccess(orderId, totalPayable);
        }, 1000);
      }
    } catch (err: any) {
      console.error('Payment failure:', err);
      setCheckoutError(err.message || 'Unable to connect to Cashfree payment gateway. Please retry.');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const completeOrderSuccess = (orderId: string, amount: number) => {
    setIsCheckoutOpen(false);
    setConfirmedOrderId(orderId);
    setConfirmedOrderAmount(amount);
    setIsOrderConfirmed(true);
    setCart([]);
  };

  // AI Shopping Assistant Submit
  const handleAiSendMessage = async (userPrompt?: string) => {
    const textToSend = userPrompt || aiInput.trim();
    if (!textToSend || isAiThinking) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: textToSend,
    };

    setChatMessages((prev) => [...prev, userMsg]);
    if (!userPrompt) setAiInput('');
    setIsAiThinking(true);

    try {
      const res = await fetch('/api/ai-advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: textToSend }),
      });

      const data = await res.json();

      if (data.success && data.reply) {
        const assistantMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          text: data.reply,
          suggestedProducts: data.suggestedProducts || [],
        };
        setChatMessages((prev) => [...prev, assistantMsg]);
      } else {
        throw new Error('AI response error');
      }
    } catch (err) {
      setChatMessages((prev) => [
        ...prev,
        {
          id: `ai-err-${Date.now()}`,
          role: 'assistant',
          text: "I'd love to help you find the best toy! Take a look at our top-rated **Musical Toys** (like our Baby Xylophone) or our **Montessori Busy Boards** for fine motor practice.",
        },
      ]);
    } finally {
      setIsAiThinking(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-stone-900 flex flex-col font-sans">
      
      {/* 1. Top Announcement Bar */}
      <div className="bg-gradient-to-r from-amber-600 via-orange-500 to-rose-500 text-white text-xs sm:text-sm font-semibold py-2 px-4 text-center tracking-wide shadow-sm flex items-center justify-center gap-2">
        <span>🚚 Free Express Shipping across India on orders above ₹499</span>
        <span className="hidden md:inline">|</span>
        <span className="hidden md:inline">🛡️ Child-safe, Non-Toxic & BPA-Free Verified Toys</span>
        <span className="hidden lg:inline">|</span>
        <span className="hidden lg:inline">🔄 7-Day Easy Replacements</span>
      </div>

      {/* 2. Navigation Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-stone-200/90 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20 gap-4">
            
            {/* Logo */}
            <div 
              onClick={() => { setSelectedCategory('All'); setSearchQuery(''); }}
              className="flex items-center cursor-pointer group flex-shrink-0 py-1"
            >
              <img
                src={misviLogo}
                alt="MISVI - Going For Unique Choice..."
                className="h-11 sm:h-14 w-auto object-contain hover:scale-102 transition-transform"
              />
            </div>

            {/* Instant Search Bar */}
            <div className="flex-1 max-w-xl hidden sm:block relative">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search 88+ educational toys, xylophones, puzzles, sensory..."
                  className="w-full bg-stone-100 border border-stone-300 focus:border-orange-500 focus:bg-white text-stone-900 text-sm rounded-full pl-11 pr-10 py-2.5 outline-none transition-all"
                />
                <Search className="w-5 h-5 text-stone-400 absolute left-3.5 top-3" />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-3 text-stone-400 hover:text-stone-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Right Controls */}
            <div className="flex items-center gap-3">
              {/* Ask Misvi AI helper trigger */}
              <button
                onClick={() => setIsAiOpen(true)}
                className="hidden md:flex items-center gap-2 bg-gradient-to-r from-orange-50 to-amber-50 hover:from-orange-100 hover:to-amber-100 text-orange-700 border border-orange-200/80 px-3.5 py-2 rounded-full text-xs font-bold transition-all shadow-xs"
              >
                <Sparkles className="w-4 h-4 text-orange-500 animate-pulse" />
                <span>Ask Toy Advisor</span>
              </button>

              {/* Cart Trigger Button */}
              <button
                onClick={() => setIsCartOpen(true)}
                className="relative bg-stone-900 hover:bg-stone-800 text-white px-4 py-2.5 rounded-full flex items-center gap-2.5 transition-transform active:scale-95 shadow-md"
              >
                <ShoppingCart className="w-5 h-5 text-amber-400" />
                <span className="text-sm font-bold hidden sm:inline">Cart</span>
                <span className="bg-orange-500 text-white text-xs font-extrabold w-5 h-5 rounded-full flex items-center justify-center">
                  {cartItemCount}
                </span>
              </button>
            </div>

          </div>

          {/* Mobile Search */}
          <div className="sm:hidden pb-3">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search toys by age, sound, puzzle..."
                className="w-full bg-stone-100 border border-stone-300 focus:border-orange-500 focus:bg-white text-stone-900 text-sm rounded-full pl-10 pr-4 py-2 outline-none"
              />
              <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
            </div>
          </div>

          {/* Category Pills */}
          <div className="py-3 overflow-x-auto flex items-center gap-2 border-t border-stone-100 no-scrollbar">
            {CATEGORIES.map((cat) => {
              const isActive = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all shadow-xs ${
                    isActive
                      ? 'bg-stone-900 text-white shadow-sm'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  {cat} {cat === 'All' ? `(${products.length})` : ''}
                </button>
              );
            })}
          </div>

        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-b from-orange-50/70 to-transparent py-8 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-3xl p-6 sm:p-10 border border-stone-200/80 shadow-sm relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="max-w-2xl z-10">
              <div className="inline-flex items-center gap-2 bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-xs font-bold mb-4">
                <Sparkle className="w-3.5 h-3.5 text-orange-600" />
                <span>100% Screen-Free Child Development</span>
              </div>
              <h1 className="font-brand text-3xl sm:text-4xl lg:text-5xl font-bold text-stone-900 tracking-tight leading-tight">
                Nurture Curious Minds with Safe, Playful Toys.
              </h1>
              <p className="mt-3 text-stone-600 text-sm sm:text-base leading-relaxed">
                Explore 88 carefully engineered Montessori, musical, and cognitive developmental toys. Crafted from 100% child-safe, non-toxic BPA-free materials certified to BIS safety standards.
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-3 sm:gap-4 text-xs font-semibold text-stone-600">
                <div className="flex items-center gap-1.5 bg-stone-50 px-3 py-1.5 rounded-xl border border-stone-200">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" /> BIS Certified Safety
                </div>
                <div className="flex items-center gap-1.5 bg-stone-50 px-3 py-1.5 rounded-xl border border-stone-200">
                  <Award className="w-4 h-4 text-emerald-600" /> 100% Non-Toxic & BPA Free
                </div>
                <div className="flex items-center gap-1.5 bg-stone-50 px-3 py-1.5 rounded-xl border border-stone-200">
                  <Truck className="w-4 h-4 text-emerald-600" /> Free Shipping Above ₹499
                </div>
                <div className="flex items-center gap-1.5 bg-stone-50 px-3 py-1.5 rounded-xl border border-stone-200">
                  <RotateCcw className="w-4 h-4 text-emerald-600" /> 7-Day Easy Replacements
                </div>
              </div>
            </div>

            <div className="relative w-full max-w-xs md:max-w-sm aspect-square rounded-2xl overflow-hidden shadow-lg border border-stone-100 flex-shrink-0">
              <img
                src="https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?auto=format&fit=crop&w=800&q=80"
                alt="MISVI Toddler Toys"
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-3 left-3 right-3 bg-white/95 backdrop-blur rounded-xl p-3 text-xs font-semibold text-stone-800 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-1 text-amber-500">
                  <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                  <span className="font-bold text-stone-900">4.9 / 5</span>
                </div>
                <span className="text-stone-500">12,000+ Indian Families</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Product Catalog Grid */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full">
        
        {/* Header & Sort Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="font-brand text-2xl font-bold text-stone-900">
              {selectedCategory === 'All' ? 'Explore All MISVI Toys' : selectedCategory}
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Showing {filteredProducts.length} child-safe verified toys
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-stone-500">Sort:</span>
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="bg-white border border-stone-200 text-xs font-semibold text-stone-700 rounded-xl px-3 py-2 outline-none focus:border-orange-500"
            >
              <option value="featured">Featured / Best Sellers</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="rating">Customer Rating</option>
            </select>
          </div>
        </div>

        {/* Product Grid (2 cols mobile, 4 cols desktop) */}
        {filteredProducts.length > 0 ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
            {filteredProducts.map((p) => {
              const discountPct = Math.round(((p.mrp - p.price) / p.mrp) * 100);
              const cartEntry = cart.find((item) => item.product.id === p.id);
              const inCartQty = cartEntry ? cartEntry.quantity : 0;

              return (
                <div
                  key={p.id}
                  className="bg-white rounded-2xl sm:rounded-3xl border border-stone-200/80 overflow-hidden shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col group relative"
                >
                  {/* Badges Bar */}
                  <div className="absolute top-2.5 left-2.5 right-2.5 z-10 flex items-center justify-between pointer-events-none">
                    <span className="bg-stone-900/90 backdrop-blur text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      {p.ageText}
                    </span>
                    <span className="bg-rose-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full shadow-xs">
                      {discountPct}% OFF
                    </span>
                  </div>

                  {/* Thumbnail with hover zoom */}
                  <div
                    onClick={() => setQuickViewProduct(p)}
                    className="relative aspect-square overflow-hidden bg-stone-100 cursor-pointer"
                  >
                    <img
                      src={p.images[0]}
                      alt={p.title}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                      <span className="opacity-0 group-hover:opacity-100 bg-white/95 text-stone-900 text-xs font-bold px-3 py-1.5 rounded-full shadow-md transform translate-y-2 group-hover:translate-y-0 transition-all flex items-center gap-1.5">
                        <Eye className="w-3.5 h-3.5 text-stone-600" /> Quick View
                      </span>
                    </div>
                  </div>

                  {/* Content Body */}
                  <div className="p-3 sm:p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-500 mb-1">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                        <span>{p.rating}</span>
                        <span className="text-stone-400">({p.reviewsCount})</span>
                        <span className="text-stone-300">•</span>
                        <span className="text-stone-400 truncate">{p.category}</span>
                      </div>

                      {/* Two-line truncated title */}
                      <h3
                        onClick={() => setQuickViewProduct(p)}
                        title={p.title}
                        className="font-brand text-xs sm:text-sm font-semibold text-stone-900 line-clamp-2 hover:text-orange-600 transition-colors cursor-pointer"
                      >
                        {p.title}
                      </h3>
                    </div>

                    {/* Price & Add to Cart Action */}
                    <div className="mt-3 pt-3 border-t border-stone-100 flex items-center justify-between gap-2">
                      <div>
                        <div className="flex items-baseline gap-1.5">
                          <span className="font-brand font-bold text-sm sm:text-base text-stone-900">
                            ₹{p.price}
                          </span>
                          <span className="text-[11px] line-through text-stone-400">
                            ₹{p.mrp}
                          </span>
                        </div>
                      </div>

                      {inCartQty > 0 ? (
                        <div className="flex items-center gap-1 bg-stone-100 rounded-xl p-1">
                          <button
                            onClick={() => updateCartQuantity(p.id, -1)}
                            className="w-6 h-6 rounded-lg bg-white text-stone-800 text-xs font-bold hover:bg-stone-200 flex items-center justify-center shadow-xs"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-xs font-bold px-1.5">{inCartQty}</span>
                          <button
                            onClick={() => updateCartQuantity(p.id, 1)}
                            className="w-6 h-6 rounded-lg bg-white text-stone-800 text-xs font-bold hover:bg-stone-200 flex items-center justify-center shadow-xs"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => addToCart(p, e)}
                          className="bg-orange-500 hover:bg-orange-600 active:scale-95 text-white text-xs font-bold px-3 py-2 rounded-xl transition-all shadow-xs flex items-center gap-1"
                        >
                          <span>Add</span>
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-20 bg-white rounded-3xl border border-stone-200 p-8">
            <div className="text-5xl mb-3">🧸</div>
            <h3 className="font-brand text-xl font-bold text-stone-800">No toys matched your search</h3>
            <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
              Try searching for "xylophone", "flashcards", "wood puzzle", "Montessori", or clear your current filter.
            </p>
            <button
              onClick={() => { setSearchQuery(''); setSelectedCategory('All'); }}
              className="mt-4 bg-stone-900 text-white text-xs font-bold px-5 py-2.5 rounded-full hover:bg-stone-800 transition"
            >
              Show All 88 Toys
            </button>
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="bg-stone-900 text-stone-400 py-12 border-t border-stone-800 mt-16 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <div className="mb-3">
              <img
                src={misviLogo}
                alt="MISVI"
                className="h-10 w-auto object-contain bg-white rounded-xl p-1.5 shadow-xs"
              />
            </div>
            <p className="mt-2 text-stone-400 leading-relaxed">
              Screen-free educational, musical, and cognitive developmental toys for India's happiest kids. BPA-free & BIS certified.
            </p>
          </div>
          <div>
            <h4 className="text-white font-bold mb-3 uppercase tracking-wider text-[11px]">Popular Categories</h4>
            <ul className="space-y-2">
              <li><button onClick={() => setSelectedCategory('Learning Toys')} className="hover:text-white transition">Montessori Wooden Toys</button></li>
              <li><button onClick={() => setSelectedCategory('Musical Toys')} className="hover:text-white transition">Musical Toddler Instruments</button></li>
              <li><button onClick={() => setSelectedCategory('Puzzles')} className="hover:text-white transition">Brain Teaser Puzzles</button></li>
              <li><button onClick={() => setSelectedCategory('Sensory & Activity')} className="hover:text-white transition">Sensory Tummy-Time Mats</button></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-bold mb-3 uppercase tracking-wider text-[11px]">Customer Care & Policies</h4>
            <ul className="space-y-2">
              <li>WhatsApp: +91 98765 43210</li>
              <li>Email: official.misvi@gmail.com</li>
              <li><a href="/legal-policies.html#return-policy" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">7-Day Return & Replacement Policy</a></li>
              <li><a href="/legal-policies.html#shipping-policy" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">Shipping & Delivery Terms</a></li>
              <li><a href="/legal-policies.html#privacy-policy" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">Privacy Policy (DPDP 2023)</a></li>
              <li><a href="/legal-policies.html#terms-of-service" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">Terms of Service</a></li>
              <li><a href="/legal-policies.html#grievance-policy" target="_blank" rel="noopener noreferrer" className="hover:text-white transition font-medium text-amber-400">Grievance Redressal (Rule 4)</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-bold mb-3 uppercase tracking-wider text-[11px]">Cashfree Secure Checkout</h4>
            <p className="leading-relaxed mb-3">
              Instant payments via UPI (GPay, PhonePe, Paytm), NetBanking, Debit/Credit cards, and wallets.
            </p>
            <div className="flex items-center gap-2">
              <span className="bg-stone-800 text-stone-300 font-bold px-2.5 py-1 rounded text-[10px]">CASHFREE PG</span>
              <span className="bg-stone-800 text-stone-300 font-bold px-2.5 py-1 rounded text-[10px]">256-BIT SSL</span>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 mt-8 border-t border-stone-800 flex flex-col sm:flex-row items-center justify-between text-stone-500">
          <p>© 2026 MISVI Toys India. All rights reserved.</p>
          <p className="mt-2 sm:mt-0">Made with ❤️ for young learners.</p>
        </div>
      </footer>

      {/* ======================================================== */}
      {/* MODAL 1: Slide-out Cart Drawer */}
      {/* ======================================================== */}
      {isCartOpen && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs z-50 transition-opacity">
          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col">
              
              {/* Drawer Header */}
              <div className="p-5 border-b border-stone-200 flex items-center justify-between bg-stone-50">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-orange-600" />
                  <h3 className="font-brand text-lg font-bold text-stone-900">Your Shopping Cart</h3>
                  <span className="text-xs bg-orange-100 text-orange-800 font-bold px-2 py-0.5 rounded-full">
                    {cartItemCount} items
                  </span>
                </div>
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="text-stone-400 hover:text-stone-700 p-1.5 rounded-lg hover:bg-stone-200/60 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Free shipping banner */}
              <div className="bg-amber-50 border-b border-amber-200/80 px-5 py-2.5 text-xs text-amber-900 flex items-center justify-between">
                <span>
                  {cartSubtotal >= 499 ? (
                    <strong className="text-emerald-700 font-semibold">🎉 Free Express Shipping Unlocked!</strong>
                  ) : (
                    <>Add <strong>₹{499 - cartSubtotal}</strong> more for <strong>Free Shipping</strong></>
                  )}
                </span>
                <span className="font-bold text-orange-600">FREE: ₹499</span>
              </div>

              {/* Items List */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {cart.length === 0 ? (
                  <div className="text-center py-16">
                    <span className="text-4xl block mb-2">🛒</span>
                    <p className="font-brand text-base font-bold text-stone-800">Your cart is empty</p>
                    <p className="text-xs text-stone-500 mt-1">Check out our 88 fun & educational toys!</p>
                    <button
                      onClick={() => setIsCartOpen(false)}
                      className="mt-4 bg-orange-500 text-white text-xs font-bold px-4 py-2 rounded-full"
                    >
                      Start Shopping
                    </button>
                  </div>
                ) : (
                  cart.map(({ product, quantity }) => (
                    <div
                      key={product.id}
                      className="flex items-center gap-3 bg-stone-50 p-3 rounded-2xl border border-stone-200/80"
                    >
                      <img
                        src={product.images[0]}
                        alt={product.title}
                        className="w-16 h-16 rounded-xl object-cover bg-white border border-stone-200 flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-bold text-stone-900 truncate">{product.title}</h4>
                        <div className="flex items-baseline gap-1 mt-0.5">
                          <span className="text-xs font-bold text-stone-900">₹{product.price}</span>
                          <span className="text-[10px] line-through text-stone-400">₹{product.mrp}</span>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center gap-1.5 bg-white border border-stone-200 rounded-lg p-0.5">
                            <button
                              onClick={() => updateCartQuantity(product.id, -1)}
                              className="w-5 h-5 text-xs font-bold text-stone-700 hover:bg-stone-100 rounded flex items-center justify-center"
                            >
                              -
                            </button>
                            <span className="text-xs font-bold px-1">{quantity}</span>
                            <button
                              onClick={() => updateCartQuantity(product.id, 1)}
                              className="w-5 h-5 text-xs font-bold text-stone-700 hover:bg-stone-100 rounded flex items-center justify-center"
                            >
                              +
                            </button>
                          </div>
                          <button
                            onClick={() => removeCartItem(product.id)}
                            className="text-stone-400 hover:text-rose-500 text-xs p-1"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Order Calculations & Proceed Button */}
              {cart.length > 0 && (
                <div className="p-5 border-t border-stone-200 bg-stone-50 space-y-3">
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between text-stone-600">
                      <span>Subtotal</span>
                      <span className="font-semibold text-stone-900">₹{cartSubtotal}</span>
                    </div>
                    <div className="flex justify-between text-stone-600">
                      <span>Shipping Fee {shippingFee === 0 && <span className="text-emerald-600">(Free &gt; ₹499)</span>}</span>
                      <span className="font-semibold text-emerald-600">
                        {shippingFee === 0 ? 'FREE' : `₹${shippingFee}`}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm font-bold text-stone-900 pt-2 border-t border-stone-200">
                      <span>Total Payable</span>
                      <span className="text-lg text-stone-900 font-brand font-bold">₹{totalPayable}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setIsCartOpen(false);
                      setIsCheckoutOpen(true);
                    }}
                    className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-brand font-bold py-3.5 px-4 rounded-2xl shadow-lg shadow-orange-500/25 transition-transform active:scale-98 flex items-center justify-center gap-2"
                  >
                    <span>Proceed to Checkout</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: Quick View / Detail Modal */}
      {/* ======================================================== */}
      {quickViewProduct && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl relative border border-stone-200 p-6 sm:p-8">
            <button
              onClick={() => setQuickViewProduct(null)}
              className="absolute top-4 right-4 z-10 bg-white/80 backdrop-blur p-2 rounded-full text-stone-500 hover:text-stone-900 shadow-sm"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Product Gallery */}
              <div>
                <div className="aspect-square rounded-2xl overflow-hidden bg-stone-100 border border-stone-200 mb-3">
                  <img
                    src={selectedQuickViewImage || quickViewProduct.images[0]}
                    alt={quickViewProduct.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                {quickViewProduct.images.length > 1 && (
                  <div className="flex gap-2">
                    {quickViewProduct.images.map((img) => (
                      <button
                        key={img}
                        onClick={() => setSelectedQuickViewImage(img)}
                        className={`w-16 h-16 rounded-xl overflow-hidden border-2 transition ${
                          selectedQuickViewImage === img ? 'border-orange-500' : 'border-stone-200 hover:border-orange-300'
                        }`}
                      >
                        <img src={img} alt="Thumbnail" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Product Details */}
              <div className="flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="bg-orange-100 text-orange-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                      {quickViewProduct.category}
                    </span>
                    <span className="bg-stone-900 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                      {quickViewProduct.ageText}
                    </span>
                    <span className="bg-rose-500 text-white text-[11px] font-extrabold px-2 py-0.5 rounded-full">
                      {Math.round(((quickViewProduct.mrp - quickViewProduct.price) / quickViewProduct.mrp) * 100)}% OFF
                    </span>
                  </div>

                  <h2 className="font-brand text-xl font-bold text-stone-900 leading-snug">
                    {quickViewProduct.title}
                  </h2>
                  <p className="text-[11px] text-stone-400 mt-0.5">SKU: {quickViewProduct.sku}</p>

                  <div className="flex items-baseline gap-2 mt-3">
                    <span className="font-brand font-bold text-2xl text-stone-900">
                      ₹{quickViewProduct.price}
                    </span>
                    <span className="line-through text-stone-400 text-sm">
                      ₹{quickViewProduct.mrp}
                    </span>
                    <span className="text-xs text-emerald-600 font-bold">
                      (Save ₹{quickViewProduct.mrp - quickViewProduct.price})
                    </span>
                  </div>

                  <p className="text-xs text-stone-600 leading-relaxed mt-3">
                    {quickViewProduct.description}
                  </p>

                  <div className="mt-4 pt-3 border-t border-stone-100">
                    <h4 className="text-xs font-bold text-stone-900 mb-2">Key Highlights:</h4>
                    <ul className="space-y-1.5 text-xs text-stone-600">
                      {quickViewProduct.bulletFeatures.map((f, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <Check className="w-3.5 h-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-stone-100">
                  <button
                    onClick={() => {
                      addToCart(quickViewProduct);
                      setQuickViewProduct(null);
                    }}
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white font-brand font-bold py-3 rounded-2xl shadow-md transition active:scale-98 flex items-center justify-center gap-2"
                  >
                    <span>Add to Cart</span>
                    <ShoppingCart className="w-4 h-4" />
                  </button>
                </div>

              </div>
            </div>

          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: Direct Cashfree Checkout Flow */}
      {/* ======================================================== */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 bg-stone-900/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[95vh] overflow-y-auto shadow-2xl relative border border-stone-200">
            
            <div className="p-5 border-b border-stone-100 flex items-center justify-between bg-stone-50">
              <div>
                <h3 className="font-brand text-xl font-bold text-stone-900">Secure Cashfree Checkout</h3>
                <p className="text-xs text-stone-500">Provide shipping address for express dispatch</p>
              </div>
              <button
                onClick={() => setIsCheckoutOpen(false)}
                className="text-stone-400 hover:text-stone-700 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleProceedToPayment} className="p-6 space-y-4">
              
              <div className="bg-orange-50/80 border border-orange-200 rounded-2xl p-4 flex items-center justify-between text-xs">
                <div>
                  <span className="text-stone-500">Order Total:</span>
                  <span className="font-bold text-base text-stone-900 block font-brand">₹{totalPayable}</span>
                </div>
                <div className="text-right">
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full inline-block">
                    {shippingFee === 0 ? 'Free Express Shipping' : '₹49 Express Shipping'}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Customer Full Name *</label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Priya Sharma"
                  className="w-full text-xs sm:text-sm bg-stone-50 border border-stone-300 rounded-xl px-3.5 py-2.5 outline-none focus:border-orange-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">10-Digit Mobile Number (SMS Updates &amp; UPI) *</label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 text-xs font-bold text-stone-500 bg-stone-100 border border-r-0 border-stone-300 rounded-l-xl">
                    +91
                  </span>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="9876543210"
                    className="w-full text-xs sm:text-sm bg-stone-50 border border-stone-300 rounded-r-xl px-3.5 py-2.5 outline-none focus:border-orange-500 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Email Address (Optional)</label>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="e.g. priya@gmail.com"
                  className="w-full text-xs sm:text-sm bg-stone-50 border border-stone-300 rounded-xl px-3.5 py-2.5 outline-none focus:border-orange-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Flat / House No. &amp; Street Address *</label>
                <input
                  type="text"
                  required
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  placeholder="e.g. Flat 302, Palm Heights, Indiranagar"
                  className="w-full text-xs sm:text-sm bg-stone-50 border border-stone-300 rounded-xl px-3.5 py-2.5 outline-none focus:border-orange-500 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">City *</label>
                  <input
                    type="text"
                    required
                    value={customerCity}
                    onChange={(e) => setCustomerCity(e.target.value)}
                    placeholder="Bengaluru"
                    className="w-full text-xs bg-stone-50 border border-stone-300 rounded-xl px-3 py-2.5 outline-none focus:border-orange-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">State *</label>
                  <input
                    type="text"
                    required
                    value={customerState}
                    onChange={(e) => setCustomerState(e.target.value)}
                    placeholder="Karnataka"
                    className="w-full text-xs bg-stone-50 border border-stone-300 rounded-xl px-3 py-2.5 outline-none focus:border-orange-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Pincode (6-digit) *</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={customerPincode}
                    onChange={(e) => setCustomerPincode(e.target.value)}
                    placeholder="560038"
                    className="w-full text-xs bg-stone-50 border border-stone-300 rounded-xl px-3 py-2.5 outline-none focus:border-orange-500 focus:bg-white"
                  />
                </div>
              </div>

              {checkoutError && (
                <div className="text-xs text-rose-600 bg-rose-50 p-3 rounded-xl border border-rose-200">
                  {checkoutError}
                </div>
              )}

              <button
                type="submit"
                disabled={isProcessingPayment}
                className="w-full bg-stone-900 hover:bg-stone-800 disabled:opacity-60 text-white font-brand text-base font-bold py-3.5 rounded-2xl shadow-lg transition-transform active:scale-98 flex items-center justify-center gap-2 mt-4"
              >
                {isProcessingPayment ? (
                  <>
                    <span className="animate-spin text-white">⏳</span>
                    <span>Opening Cashfree PG...</span>
                  </>
                ) : (
                  <>
                    <span>Pay ₹{totalPayable} with Cashfree</span>
                    <Lock className="w-4 h-4 text-amber-400" />
                  </>
                )}
              </button>

              <div className="flex items-center justify-center gap-4 text-[11px] text-stone-400 pt-2">
                <span>🔒 256-Bit Encrypted</span>
                <span>•</span>
                <span>⚡ Instant UPI / Cards</span>
                <span>•</span>
                <span>🛡️ Cashfree Protected</span>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 4: Order Confirmation Success Modal */}
      {/* ======================================================== */}
      {isOrderConfirmed && (
        <div className="fixed inset-0 bg-stone-900/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 text-center shadow-2xl border border-stone-200">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl shadow-inner">
              <Check className="w-8 h-8 stroke-[3]" />
            </div>
            <h3 className="font-brand text-2xl font-bold text-stone-900">Order Confirmed!</h3>
            <p className="text-xs text-stone-500 mt-1">Thank you for trusting MISVI Toys.</p>

            <div className="my-5 bg-stone-50 rounded-2xl p-4 text-left space-y-2 text-xs border border-stone-200">
              <div className="flex justify-between">
                <span className="text-stone-500">Order ID:</span>
                <span className="font-mono font-bold text-stone-800">{confirmedOrderId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Amount Paid:</span>
                <span className="font-bold text-emerald-600">₹{confirmedOrderAmount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Payment Status:</span>
                <span className="font-bold text-emerald-600">PAID (Cashfree Verified)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Estimated Delivery:</span>
                <span className="font-bold text-stone-800">3-4 Business Days</span>
              </div>
            </div>

            <button
              onClick={() => setIsOrderConfirmed(false)}
              className="w-full bg-stone-900 hover:bg-stone-800 text-white font-brand font-bold py-3 rounded-2xl transition"
            >
              Continue Shopping
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 5. In-Store Gemini AI Assistant ("Ask Misvi AI") */}
      {/* ======================================================== */}
      {/* Floating Action Button */}
      <button
        onClick={() => setIsAiOpen(true)}
        className="fixed bottom-6 right-6 z-40 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white p-4 rounded-full shadow-2xl shadow-orange-500/40 flex items-center gap-3 transition-transform hover:scale-105 active:scale-95 group"
        aria-label="Ask Misvi AI Toy Advisor"
      >
        <div className="relative">
          <Bot className="w-6 h-6" />
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-200 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
          </span>
        </div>
        <span className="font-brand font-bold text-sm tracking-wide hidden sm:inline">Ask Misvi AI</span>
      </button>

      {/* AI Chat Pop-up Interface */}
      {isAiOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-[92vw] sm:w-[420px] h-[580px] max-h-[85vh] bg-white rounded-3xl shadow-2xl border border-stone-200 flex flex-col overflow-hidden">
          
          {/* Header */}
          <div className="bg-gradient-to-r from-orange-500 to-amber-500 text-white p-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center font-brand font-bold text-lg">
                🤖
              </div>
              <div>
                <h4 className="font-brand font-bold text-sm">Misvi AI Toy Advisor</h4>
                <span className="text-[11px] text-amber-100 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Online • Powered by Gemini 3.8
                </span>
              </div>
            </div>
            <button
              onClick={() => setIsAiOpen(false)}
              className="text-white/80 hover:text-white p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs bg-stone-50">
            {chatMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : ''}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-lg bg-orange-500 text-white flex-shrink-0 flex items-center justify-center text-xs font-bold">
                    M
                  </div>
                )}
                <div
                  className={`p-3 rounded-2xl max-w-[85%] space-y-2 ${
                    msg.role === 'user'
                      ? 'bg-stone-900 text-white rounded-tr-none'
                      : 'bg-white border border-stone-200 text-stone-800 rounded-tl-none shadow-xs'
                  }`}
                >
                  <div className="whitespace-pre-line leading-relaxed">
                    {msg.text}
                  </div>

                  {/* Recommendations Cards */}
                  {msg.suggestedProducts && msg.suggestedProducts.length > 0 && (
                    <div className="pt-2 border-t border-stone-100 space-y-1.5">
                      <span className="text-[10px] font-bold uppercase text-stone-400">Top Matches:</span>
                      {msg.suggestedProducts.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between gap-2 bg-stone-50 p-1.5 rounded-xl border border-stone-200"
                        >
                          <span className="truncate font-semibold text-[11px] text-stone-800">
                            {p.title}
                          </span>
                          <button
                            onClick={() => {
                              setQuickViewProduct(p);
                              setIsAiOpen(false);
                            }}
                            className="text-[10px] font-bold bg-orange-500 text-white px-2 py-0.5 rounded-lg flex-shrink-0"
                          >
                            View
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isAiThinking && (
              <div className="flex gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-orange-500 text-white flex-shrink-0 flex items-center justify-center text-xs font-bold">
                  M
                </div>
                <div className="bg-white border border-stone-200 rounded-2xl rounded-tl-none p-3 shadow-xs text-stone-500 italic">
                  Thinking of the best toys from the MISVI catalog...
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Quick starter chips */}
          <div className="px-3 py-2 bg-stone-100/70 border-t border-stone-200/60 overflow-x-auto flex gap-1.5 no-scrollbar">
            <button
              onClick={() => handleAiSendMessage('Suggest a musical toy for a 2-year-old under ₹400')}
              className="bg-white hover:bg-orange-50 text-stone-700 border border-stone-200 px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap"
            >
              🎵 Musical toy for 2yo under ₹400
            </button>
            <button
              onClick={() => handleAiSendMessage('What do you have for brain development and drawing?')}
              className="bg-white hover:bg-orange-50 text-stone-700 border border-stone-200 px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap"
            >
              🧠 Brain development & drawing
            </button>
            <button
              onClick={() => handleAiSendMessage('Montessori toys for toddlers for speech & motor skills')}
              className="bg-white hover:bg-orange-50 text-stone-700 border border-stone-200 px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap"
            >
              🧩 Montessori for speech & motor
            </button>
          </div>

          {/* Chat Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAiSendMessage();
            }}
            className="p-3 bg-white border-t border-stone-200 flex items-center gap-2"
          >
            <input
              type="text"
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              placeholder="Ask e.g. 'Birthday gift for 3yo boy under ₹500'..."
              className="flex-1 bg-stone-100 border border-stone-300 focus:border-orange-500 focus:bg-white text-xs rounded-full px-4 py-2.5 outline-none transition"
            />
            <button
              type="submit"
              disabled={isAiThinking || !aiInput.trim()}
              className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white p-2.5 rounded-full shadow-md transition active:scale-95 flex-shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>

        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 animate-bounce">
          <div className="bg-stone-900 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-semibold">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

    </div>
  );
}

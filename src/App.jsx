import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus, ShoppingCart, X, Coffee, IceCream } from 'lucide-react';

// معلومات المنتجات مع الصور (تحتاج ترفع صورك في مجلد public)
const menuData = [
  { id: 1, name: 'فلات وايت', price: 18, category: 'قهوة ساخنة', image: '/flat-white.png', desc: 'إسبريسو غني مع حليب مبخر ناعم.' },
  { id: 2, name: 'آيس سبانش لاتيه', price: 22, category: 'قهوة باردة', image: '/ice-spanish.png', desc: 'حليب مكثف محلى مع إسبريسو وحليب بارد.' },
  { id: 3, name: 'كيكة العسل', price: 25, category: 'حلويات', image: '/honey-cake.png', desc: 'طبقات من الكيك الهش مع كريمة العسل الغنية.' },
  { id: 4, name: 'كابتشينو', price: 19, category: 'قهوة ساخنة', image: '/cappuccino.png', desc: 'توازن مثالي بين الإسبريسو والحليب والرغوة الغنية.' },
  { id: 5, name: 'كولد برو', price: 24, category: 'قهوة باردة', image: '/cold-brew.png', desc: 'قهوة مستخلصة ببارد لمدة 16 ساعة.' },
];

const categories = ['الكل', 'قهوة ساخنة', 'قهوة باردة', 'حلويات'];

function App() {
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState('الكل');
  const [showToast, setShowToast] = useState(false);

  // رقم الواتساب الخاص بالكوفي (ابدأ بـ 966)
  const whatsappNumber = "9665XXXXXXXXX"; 

  const addToCart = (product) => {
    setCart(prevCart => {
      const existing = prevCart.find(item => item.id === product.id);
      if (existing) {
        return prevCart.map(item =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prevCart, { ...product, quantity: 1 }];
    });
    // إظهار التنبيه
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2000);
  };

  const updateQuantity = (id, delta) => {
    setCart(prevCart => {
      const existing = prevCart.find(item => item.id === id);
      if (existing.quantity === 1 && delta === -1) {
        return prevCart.filter(item => item.id !== id);
      }
      return prevCart.map(item =>
        item.id === id ? { ...item, quantity: item.quantity + delta } : item
      );
    });
  };

  const calculateTotal = () => cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const checkoutToWhatsApp = () => {
    if (cart.length === 0) return;
    
    let message = "*طلب جديد من منيو NMAT Cafe ☕️*\n\n";
    message += "---------------------\n";
    
    cart.forEach(item => {
      message += `• *${item.name}* (x${item.quantity}) - ${item.price * item.quantity} SR\n`;
    });
    
    message += "---------------------\n";
    message += `*المجموع الكلي: ${calculateTotal()} SR*\n\n`;
    message += "يرجى تأكيد الطلب للتحضير 🌿";
    
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
  };

  const filteredMenu = activeCategory === 'الكل' 
    ? menuData 
    : menuData.filter(item => item.category === activeCategory);

  return (
    // ألوان الهوية الجديدة: الخلفية F7F8F9 والخط 429163
    <div className="min-h-screen bg-[#F7F8F9] text-[#429163] p-4 md:p-10 font-sans relative overflow-x-hidden">
      
      {/* تنبيه "تمت الإضافة" (Toast) */}
      <AnimatePresence>
        {showToast && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 bg-[#429163] text-[#F7F8F9] px-6 py-3 rounded-full shadow-lg z-[100] font-bold flex items-center gap-2"
          >
            <ShoppingCart className="w-5 h-5" />
            تمت إضافة المنتج للسلة!
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header احترافي */}
      <header className="flex justify-between items-center py-8 mb-10 border-b border-[#429163]/10">
        <div className="flex flex-col items-center">
          <h1 className="text-4xl font-extrabold tracking-widest text-[#429163]">NMAT</h1>
          <p className="text-xs uppercase tracking-[0.4em] opacity-60">Cafe & Roastery</p>
        </div>
        <img src="/nmat_logo.png" alt="Nmat Logo" className="w-16 h-16 opacity-80" />
      </header>

      {/* شريط التصنيفات الاحترافي */}
      <div className="flex gap-3 mb-12 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0">
        {categories.map(cat => (
          <button 
            key={cat} 
            onClick={() => setActiveCategory(cat)}
            className={`px-6 py-3 rounded-full text-sm font-bold whitespace-nowrap transition-all flex items-center gap-2
              ${activeCategory === cat 
                ? 'bg-[#429163] text-[#F7F8F9] shadow-md' 
                : 'bg-white text-[#429163] border border-[#429163]/10 hover:bg-[#429163]/5'
              }`}
          >
            {cat === 'الكل' && <Coffee className="w-4 h-4" />}
            {cat === 'حلويات' && <IceCream className="w-4 h-4" />}
            {cat}
          </button>
        ))}
      </div>

      {/* المنيو الرئيسي بـ الأنيميشن */}
      <main className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-32">
        <AnimatePresence>
          {filteredMenu.map((item) => (
            <motion.div 
              key={item.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.3 }}
              className="bg-white rounded-3xl p-6 shadow-sm border border-[#429163]/10 hover:shadow-2xl transition-all duration-300 group flex flex-col"
            >
              <div className="aspect-[16/10] rounded-2xl overflow-hidden mb-5 relative shadow-inner bg-[#F7F8F9]">
                <img src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              </div>
              <div className="flex-grow space-y-2">
                <div className="flex justify-between items-start">
                  <h3 className="text-2xl font-bold leading-none text-[#429163]">{item.name}</h3>
                  <div className="text-2xl font-extrabold text-[#429163] whitespace-nowrap">{item.price} SR</div>
                </div>
                <p className="text-sm opacity-60 text-gray-600 leading-relaxed">{item.desc}</p>
              </div>
              <button 
                onClick={() => addToCart(item)}
                className="mt-6 w-full bg-[#429163] text-[#F7F8F9] py-4 rounded-xl flex items-center justify-center gap-2 font-bold hover:opacity-90 active:scale-[0.98] transition-all text-lg shadow-md"
              >
                <Plus className="w-5 h-5" />
                أضف للسلة / Add
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </main>

      {/* زر السلة العائم الاحترافي */}
      <motion.button 
        onClick={() => setIsCartOpen(true)}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        className="fixed bottom-8 right-8 bg-[#429163] text-[#F7F8F9] p-5 rounded-full shadow-2xl z-40 flex items-center gap-3 border-4 border-white"
      >
        <ShoppingCart className="w-8 h-8" />
        {cart.length > 0 && (
          <span className="bg-red-500 text-white text-xs font-bold rounded-full w-6

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus, ShoppingCart, X, Coffee, IceCream } from 'lucide-react';

// بيانات المنتجات
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

  // رقم الواتساب الخاص بك (تأكد من تغييره)
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
    let message = "*طلب جديد من NMAT Cafe ☕️*\n\n";
    cart.forEach(item => {
      message += `• *${item.name}* (x${item.quantity}) - ${item.price * item.quantity} SR\n`;
    });
    message += `\n*المجموع الكلي: ${calculateTotal()} SR*`;
    window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const filteredMenu = activeCategory === 'الكل' 
    ? menuData 
    : menuData.filter(item => item.category === activeCategory);

  return (
    <div className="min-h-screen bg-[#F7F8F9] text-[#429163] p-4 md:p-10 font-sans relative overflow-x-hidden">
      
      {/* Toast Notification */}
      <AnimatePresence>
        {showToast && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 bg-[#429163] text-white px-6 py-3 rounded-full shadow-lg z-[100] font-bold flex items-center gap-2">
            تمت إضافة المنتج!
          </motion.div>
        )}
      </AnimatePresence>

      <header className="flex justify-between items-center py-8 mb-10 border-b border-[#429163]/10">
        <div className="flex flex-col items-center">
          <h1 className="text-4xl font-extrabold tracking-widest text-[#429163]">NMAT</h1>
          <p className="text-xs uppercase tracking-[0.4em] opacity-60 text-[#429163]">Cafe & Roastery</p>
        </div>
      </header>

      {/* Category Tabs */}
      <div className="flex gap-3 mb-12 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0">
        {categories.map(cat => (
          <button key={cat} onClick={() => setActiveCategory(cat)}
            className={`px-6 py-3 rounded-full text-sm font-bold transition-all ${activeCategory === cat ? 'bg-[#429163] text-white shadow-md' : 'bg-white text-[#429163] border border-[#429163]/10'}`}>
            {cat}
          </button>
        ))}
      </div>

      {/* Menu Grid */}
      <main className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-32">
        <AnimatePresence>
          {filteredMenu.map((item) => (
            <motion.div key={item.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="bg-white rounded-3xl p-6 shadow-sm border border-[#429163]/10 hover:shadow-xl transition-all flex flex-col">
              <div className="aspect-[16/10] rounded-2xl overflow-hidden mb-5 bg-[#F7F8F9]">
                <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
              </div>
              <div className="flex-grow space-y-2">
                <div className="flex justify-between items-start">
                  <h3 className="text-2xl font-bold text-[#429163]">{item.name}</h3>
                  <div className="text-2xl font-extrabold text-[#429163]">{item.price} SR</div>
                </div>
                <p className="text-sm opacity-60 text-[#429163]/80">{item.desc}</p>
              </div>
              <button onClick={() => addToCart(item)}
                className="mt-6 w-full bg-[#429163] text-white py-4 rounded-xl flex items-center justify-center gap-2 font-bold hover:opacity-90 active:scale-95 transition-all shadow-md">
                <Plus className="w-5 h-5" /> أضف للسلة
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </main>

      {/* Floating Cart Button */}
      <motion.button onClick={() => setIsCartOpen(true)} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
        className="fixed bottom-8 right-8 bg-[#429163] text-white p-5 rounded-full shadow-2xl z-40 flex items-center border-4 border-white">
        <ShoppingCart className="w-8 h-8" />
        {cart.length > 0 && (
          <span className="bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center absolute -top-2 -right-2">
            {cart.reduce((sum, item) => sum + item.quantity, 0)}
          </span>
        )}
      </motion.button>

      {/* Sidebar Cart */}
      <AnimatePresence>
        {isCartOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm" onClick={() => setIsCartOpen(false)}>
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              className="absolute right-0 top-0 h-full w-full max-w-lg bg-white p-8 shadow-2xl flex flex-col"
              onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-10 pb-5 border-b border-[#429163]/10">
                <h2 className="text-3xl font-bold text-[#429163] flex items-center gap-3"><ShoppingCart /> سلة الطلبات</h2>
                <button onClick={() => setIsCartOpen(false)}><X className="w-8 h-8 text-gray-500" /></button>
              </div>

              <div className="flex-grow space-y-6 overflow-y-auto">
                {cart.map(item => (
                  <div key={item.id} className="flex justify-between items-center bg-[#F7F8F9] p-4 rounded-2xl border border-gray-100 shadow-sm text-[#429163]">
                    <div className="flex-1 font-bold">{item.name}</div>
                    <div className="flex items-center gap-3 bg-white rounded-full p-1 border border-[#429163]/20">
                      <button onClick={() => updateQuantity(item.id, -1)} className="p-1"><Minus className="w-4 h-4" /></button>
                      <span className="font-bold w-6 text-center">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.id, 1)} className="p-1"><Plus className="w-4 h-4" /></button>
                    </div>
                    <div className="font-extrabold ml-4">{item.price * item.quantity} SR</div>
                  </div>
                ))}
              </div>

              {cart.length > 0 && (
                <div className="mt-auto pt-8 border-t border-[#429163]/10">
                  <div className="flex justify-between items-center text-3xl font-extrabold text-[#429163] mb-6">
                    <span>المجموع:</span> <span>{calculateTotal()} SR</span>
                  </div>
                  <button onClick={checkoutToWhatsApp}
                    className="w-full bg-[#429163] text-white py-5 rounded-3xl flex items-center justify-center gap-4 font-bold text-xl shadow-xl">
                    🚀 تأكيد عبر واتساب
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;

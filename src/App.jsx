import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus, ShoppingCart, X, Coffee } from 'lucide-react';

// بيانات المنتجات
const menuData = [
  { id: 1, name: 'فلات وايت', price: 18, category: 'قهوة ساخنة', image: '/flat-white.png', desc: 'إسبريسو غني مع حليب مبخر ناعم.' },
  { id: 2, name: 'آيس سبانش لاتيه', price: 22, category: 'قهوة باردة', image: '/ice-spanish.png', desc: 'حليب مكثف محلى مع إسبريسو وحليب بارد.' },
  { id: 3, name: 'كيكة العسل', price: 25, category: 'حلويات', image: '/honey-cake.png', desc: 'طبقات من الكيك الهش مع كريمة العسل الغنية.' },
];

const categories = ['الكل', 'قهوة ساخنة', 'قهوة باردة', 'حلويات'];

export default function App() {
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState('الكل');
  
  // رقم الواتساب الخاص بك
  const whatsappNumber = "9665XXXXXXXXX"; 

  const addToCart = (product) => {
    setCart(prev => {
      const exist = prev.find(p => p.id === product.id);
      if (exist) return prev.map(p => p.id === product.id ? {...p, qty: p.qty + 1} : p);
      return [...prev, {...product, qty: 1}];
    });
  };

  const updateQty = (id, d) => {
    setCart(prev => prev.map(p => p.id === id ? {...p, qty: Math.max(0, p.qty + d)} : p).filter(p => p.qty > 0));
  };

  const total = cart.reduce((s, i) => s + (i.price * i.qty), 0);

  const sendOrder = () => {
    let msg = "*طلب جديد - NMAT Cafe*\n" + cart.map(i => `• ${i.name} (x${i.qty})`).join('\n') + `\n\n*المجموع: ${total} SR*`;
    window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const filtered = activeCategory === 'الكل' ? menuData : menuData.filter(i => i.category === activeCategory);

  return (
    // استخدام ألوان الهوية هنا
    <div className="min-h-screen bg-nmat-bg text-nmat-text font-sans selection:bg-nmat-text/10 relative overflow-x-hidden">
      
      {/* Header احترافي بلمسة أنيميشن */}
      <motion.header 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-8 text-center border-b border-nmat-text/10 bg-white shadow-sm sticky top-0 z-40"
      >
        <h1 className="text-5xl font-black tracking-tighter italic text-nmat-text">NMAT.</h1>
        <p className="text-[11px] tracking-[0.6em] opacity-50 uppercase mt-1 text-nmat-text">Specialty Coffee</p>
      </motion.header>

      {/* شريط التصنيفات العائم */}
      <div className="flex gap-2 p-5 overflow-x-auto justify-center sticky top-[105px] z-30 bg-nmat-bg/80 backdrop-blur-sm">
        {categories.map(c => (
          <button key={c} onClick={() => setActiveCategory(c)} className={`px-6 py-2.5 rounded-full text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${activeCategory === c ? 'bg-nmat-text text-white shadow-lg scale-105' : 'bg-white text-nmat-text border border-nmat-text/20 hover:bg-nmat-text/5'}`}>{c}</button>
        ))}
      </div>

      {/* المنيو الرئيسي بـ كروت احترافية وأنيميشن */}
      <main className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto pb-36">
        <AnimatePresence>
          {filtered.map(item => (
            <motion.div 
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              whileHover={{ y: -5 }}
              className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-nmat-text/5 flex flex-col gap-5 hover:shadow-2xl transition-all duration-300 group"
            >
              <div className="aspect-[16/10] bg-nmat-bg rounded-3xl overflow-hidden flex-shrink-0 shadow-inner">
                <img src={item.image} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt={item.name} />
              </div>
              <div className="flex-grow space-y-2">
                <div className="flex justify-between items-start gap-2">
                  <h3 className="font-bold text-2xl text-nmat-text leading-tight">{item.name}</h3>
                  <div className="text-2xl font-black text-nmat-text whitespace-nowrap">{item.price} SR</div>
                </div>
                <p className="text-sm opacity-70 text-nmat-text/80 leading-relaxed">{item.desc}</p>
              </div>
              <button onClick={() => addToCart(item)} className="w-full bg-nmat-text text-white py-4 rounded-2xl text-sm font-bold active:scale-95 transition-all shadow-md hover:opacity-95 flex items-center justify-center gap-2">+ أضف للسلة / Add</button>
            </motion.div>
          ))}
        </AnimatePresence>
      </main>

      {/* زر السلة العائم الاحترافي */}
      <motion.button 
        onClick={() => setIsCartOpen(true)} 
        whileHover={{ scale: 1.1 }} 
        whileTap={{ scale: 0.9 }}
        className="fixed bottom-8 right-8 bg-nmat-text text-white p-6 rounded-full shadow-2xl flex items-center gap-3 font-bold z-50 border-4 border-white"
      >
        <ShoppingCart size={24} />
        {cart.length > 0 && (
          <span className="bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center absolute -top-2 -right-2 border-2 border-white">
            {cart.reduce((a, b) => a + b.qty, 0)}
          </span>
        )}
      </motion.button>

      {/* الـ Sidebar الخاص بالسلة (الطلب) بـ أنيميشن ناعم */}
      <AnimatePresence>
        {isCartOpen && (
          <motion.div initial={{opacity: 0}} animate={{opacity: 1}} exit={{opacity: 0}} className="fixed inset-0 bg-black/60 z-[60] backdrop-blur-sm" onClick={() => setIsCartOpen(false)}>
            <motion.div initial={{x: '100%'}} animate={{x: 0}} exit={{x: '100%'}} transition={{type: 'tween'}}
              className="absolute right-0 top-0 h-full w-full max-w-lg bg-white z-[70] p-8 flex flex-col shadow-2xl rounded-l-[3rem]"
              onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-10 pb-5 border-b border-nmat-text/10 font-black text-3xl text-nmat-text italic">
                <span className="flex items-center gap-3"><ShoppingCart size={28}/> MY CART</span>
                <X onClick={() => setIsCartOpen(false)} className="cursor-pointer text-gray-400 hover:text-gray-600"/>
              </div>
              <div className="flex-grow overflow-y-auto space-y-5 pr-2 -mr-2 selection:bg-nmat-text/10">
                {cart.map(i => (
                  <div key={i.id} className="flex justify-between items-center bg-nmat-bg p-5 rounded-2xl border border-gray-100 shadow-sm text-nmat-text">
                    <span className="font-bold text-lg">{i.name}</span>
                    <div className="flex items-center gap-4 bg-white px-4 py-2 rounded-full border border-nmat-text/20 shadow-inner">
                      <Minus size={16} onClick={() => updateQty(i.id, -1)} className="cursor-pointer hover:scale-110"/>
                      <span className="font-bold text-xl w-6 text-center">{i.qty}</span>
                      <Plus size={16} onClick={() => updateQty(i.id, 1)} className="cursor-pointer hover:scale-110"/>
                    </div>
                  </div>
                ))}
              </div>
              {cart.length > 0 && (
                <div className="mt-auto pt-8 border-t border-nmat-text/10 space-y-6">
                  <div className="flex justify-between text-3xl font-black text-nmat-text">
                    <span>Total:</span> <span>{total} SR</span>
                  </div>
                  <button onClick={sendOrder} className="w-full bg-nmat-text text-white py-5 rounded-3xl font-bold text-xl shadow-xl uppercase tracking-widest hover:opacity-95 active:scale-95 transition-all">🚀 Confirm Order</button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

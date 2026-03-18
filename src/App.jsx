import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus, ShoppingCart, X } from 'lucide-react';

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
    <div className="min-h-screen bg-[#F7F8F9] text-[#429163] font-sans">
      <header className="p-8 text-center border-b border-[#429163]/10 bg-white shadow-sm">
        <h1 className="text-4xl font-black tracking-tighter italic">NMAT.</h1>
        <p className="text-[10px] tracking-[0.5em] opacity-50 uppercase mt-1">Specialty Coffee</p>
      </header>

      <div className="flex gap-2 p-4 overflow-x-auto justify-center">
        {categories.map(c => (
          <button key={c} onClick={() => setActiveCategory(c)} className={`px-5 py-2 rounded-full text-xs font-bold transition-all ${activeCategory === c ? 'bg-[#429163] text-white shadow-lg' : 'bg-white text-[#429163] border border-[#429163]/20'}`}>{c}</button>
        ))}
      </div>

      <main className="p-4 grid gap-6 max-w-5xl mx-auto pb-32">
        {filtered.map(item => (
          <motion.div layout key={item.id} className="bg-white rounded-[2rem] p-4 shadow-sm border border-[#429163]/5 flex items-center gap-4">
            <div className="w-24 h-24 bg-[#F7F8F9] rounded-2xl overflow-hidden flex-shrink-0">
              <img src={item.image} className="w-full h-full object-cover" alt={item.name} />
            </div>
            <div className="flex-grow">
              <h3 className="font-bold text-lg">{item.name}</h3>
              <p className="text-xs opacity-60 mb-2">{item.price} SR</p>
              <button onClick={() => addToCart(item)} className="bg-[#429163] text-white px-4 py-2 rounded-xl text-xs font-bold active:scale-95 transition-all">+ أضف</button>
            </div>
          </motion.div>
        ))}
      </main>

      <button onClick={() => setIsCartOpen(true)} className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#429163] text-white px-8 py-4 rounded-full shadow-2xl flex items-center gap-3 font-bold z-50">
        <ShoppingCart size={20} /> سلة الطلبات ({cart.reduce((a, b) => a + b.qty, 0)})
      </button>

      <AnimatePresence>
        {isCartOpen && (
          <motion.div initial={{y: '100%'}} animate={{y: 0}} exit={{y: '100%'}} className="fixed inset-0 bg-white z-[60] p-6 flex flex-col">
            <div className="flex justify-between mb-8 italic font-black text-2xl">
              <span>MY CART</span>
              <X onClick={() => setIsCartOpen(false)} />
            </div>
            <div className="flex-grow overflow-y-auto space-y-4">
              {cart.map(i => (
                <div key={i.id} className="flex justify-between items-center bg-[#F7F8F9] p-4 rounded-2xl">
                  <span className="font-bold">{i.name}</span>
                  <div className="flex items-center gap-4 bg-white px-3 py-1 rounded-full border border-[#429163]/20">
                    <Minus size={14} onClick={() => updateQty(i.id, -1)} />
                    <span className="font-bold">{i.qty}</span>
                    <Plus size={14} onClick={() => updateQty(i.id, 1)} />
                  </div>
                </div>
              ))}
            </div>
            <div className="pt-6 border-t">
              <div className="flex justify-between text-2xl font-bold mb-6">
                <span>Total:</span>
                <span>{total} SR</span>
              </div>
              <button onClick={sendOrder} className="w-full bg-[#429163] text-white py-5 rounded-2xl font-bold text-lg shadow-xl uppercase tracking-widest">Confirm Order</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

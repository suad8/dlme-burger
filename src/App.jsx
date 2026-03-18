import React, { useState } from 'react';
import { Plus, Minus, ShoppingCart, X } from 'lucide-react';

// معلومات المنتجات مع الصور (عليك إضافة صورك في مجلد public)
const menuData = [
  { id: 1, name: 'فلات وايت', price: 18, category: 'قهوة ساخنة', image: '/flat-white.png' },
  { id: 2, name: 'آيس سبانش لاتيه', price: 22, category: 'قهوة باردة', image: '/ice-spanish.png' },
  { id: 3, name: 'كيكة العسل', price: 25, category: 'حلويات', image: '/honey-cake.png' },
  { id: 4, name: 'كابتشينو', price: 19, category: 'قهوة ساخنة', image: '/cappuccino.png' },
];

function App() {
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

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

  return (
    // ألوان الهوية الجديدة: الخلفية F7F8F9 والخط 429163
    <div className="min-h-screen bg-[#F7F8F9] text-[#429163] p-4 md:p-8 font-sans">
      
      {/* Header مع السلة */}
      <header className="flex justify-between items-center py-6 border-b border-[#429163]/10 mb-8">
        <h1 className="text-3xl font-bold tracking-widest text-[#429163]">NMAT</h1>
        <button 
          onClick={() => setIsCartOpen(true)}
          className="relative flex items-center gap-2 p-2 rounded-full hover:bg-[#429163]/5"
        >
          <ShoppingCart className="w-6 h-6 text-[#429163]" />
          {cart.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-[#429163] text-[#F7F8F9] text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {cart.reduce((sum, item) => sum + item.quantity, 0)}
            </span>
          )}
        </button>
      </header>

      {/* المنيو الرئيسي */}
      <main className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
        {menuData.map((item) => (
          <div key={item.id} className="bg-white p-5 rounded-2xl shadow-sm border border-[#429163]/10 hover:shadow-lg transition-all group flex flex-col">
            <div className="aspect-[4/3] rounded-xl overflow-hidden mb-4 relative">
              <img src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
            </div>
            <div className="flex justify-between items-start flex-grow">
              <div>
                <h3 className="text-lg font-bold leading-none text-[#429163]">{item.name}</h3>
                <span className="text-xs opacity-60 italic">{item.category}</span>
              </div>
              <div className="text-xl font-bold text-[#429163]">{item.price} SR</div>
            </div>
            <button 
              onClick={() => addToCart(item)}
              className="mt-5 w-full bg-[#429163] text-[#F7F8F9] py-3 rounded-xl flex items-center justify-center gap-2 font-bold hover:opacity-90 active:scale-[0.98] transition-all"
            >
              <Plus className="w-5 h-5" />
              أضف للسلة / Add
            </button>
          </div>
        ))}
      </main>

      {/* الـ Footer الجديد */}
      <footer className="mt-20 text-center pb-6 opacity-40 text-xs">
        <p>شكرًا لزيارتكم nmat.sa</p>
        <p>كل الحب، فريق NMAT 🌿</p>
      </footer>

      {/* الـ Sidebar الخاص بالسلة (الطلب) */}
      {isCartOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 transition-opacity backdrop-blur-sm" onClick={() => setIsCartOpen(false)}>
          <div 
            className="absolute right-0 top-0 h-full w-full max-w-md bg-white p-6 shadow-2xl flex flex-col rounded-l-3xl transition-transform"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-8 pb-4 border-b border-[#429163]/10">
              <h2 className="text-2xl font-bold text-[#429163] flex items-center gap-2">
                <ShoppingCart />
                سلة الطلبات
              </h2>
              <button onClick={() => setIsCartOpen(false)} className="p-2 rounded-full hover:bg-gray-100">
                <X className="w-6 h-6 text-gray-500" />
              </button>
            </div>

            {cart.length === 0 ? (
              <div className="flex-grow flex flex-col items-center justify-center text-center opacity-40">
                <ShoppingCart className="w-16 h-16 mb-4" />
                <p>السلة فارغة. ابدأ بإضافة المنتجات!</p>
              </div>
            ) : (
              <>
                <div className="flex-grow space-y-5 overflow-y-auto pr-2">
                  {cart.map(item => (
                    <div key={item.id} className="flex justify-between items-center gap-4 bg-[#F7F8F9]/50 p-3 rounded-xl border border-gray-100">
                      <div>
                        <h4 className="font-bold text-[#429163]">{item.name}</h4>
                        <p className="text-sm opacity-60">{item.price} SR</p>
                      </div>
                      <div className="flex items-center gap-2 border-2 border-[#429163]/10 rounded-full p-1 bg-white">
                        <button onClick={() => updateQuantity(item.id, -1)} className="p-1 rounded-full text-[#429163] hover:bg-[#429163]/5">
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="font-bold text-lg w-6 text-center text-[#429163]">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.id, 1)} className="p-1 rounded-full text-[#429163] hover:bg-[#429163]/5">
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="text-lg font-bold text-[#429163]">
                        {item.price * item.quantity} SR
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-auto border-t border-[#429163]/10 pt-6 space-y-4">
                  <div className="flex justify-between items-center text-2xl font-bold text-[#429163]">
                    <span>المجموع / Total:</span>
                    <span>{calculateTotal()} SR</span>
                  </div>
                  <button 
                    onClick={checkoutToWhatsApp}
                    className="w-full bg-[#429163] text-[#F7F8F9] py-4 rounded-2xl flex items-center justify-center gap-3 font-bold text-lg hover:opacity-95 active:scale-[0.99]"
                  >
                    🚀 تأكيد الطلب عبر واتساب
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

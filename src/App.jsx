import React from 'react';

const menuData = [
  { id: 1, name: 'فلات وايت', price: '18 SR', category: 'قهوة ساخنة' },
  { id: 2, name: 'آيس سبانش لاتيه', price: '22 SR', category: 'قهوة باردة' },
  { id: 3, name: 'كيكة العسل', price: '25 SR', category: 'حلويات' },
  { id: 4, name: 'كابتشينو', price: '19 SR', category: 'قهوة ساخنة' },
];

function App() {
  return (
    <div className="min-h-screen bg-nmat-beige text-nmat-black p-6 font-sans">
      <header className="py-12 text-center">
        {/* تأكد من وضع صورة اللوجو في مجلد public باسم nmat_logo.png */}
        <h1 className="text-4xl font-bold tracking-widest mb-2">NMAT</h1>
        <p className="text-sm uppercase tracking-[0.3em] opacity-70">Cafe & Roastery</p>
      </header>

      <main className="max-w-md mx-auto">
        <div className="border-t border-nmat-black mb-10"></div>
        
        <div className="space-y-12">
          <section>
            <h2 className="text-xl font-bold mb-6 border-b border-black/10 pb-2">القائمة / Menu</h2>
            <div className="space-y-8">
              {menuData.map((item) => (
                <div key={item.id} className="flex justify-between items-end">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold leading-none">{item.name}</h3>
                    <span className="text-xs opacity-50 italic">{item.category}</span>
                  </div>
                  <div className="border-b border-dotted border-black/20 flex-grow mx-2 mb-1"></div>
                  <div className="text-lg font-bold">{item.price}</div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <footer className="mt-24 text-center pb-10">
          <p className="text-xs opacity-40">شكرًا لزيارتكم nmat.sa</p>
        </footer>
      </main>
    </div>
  );
}

export default App;

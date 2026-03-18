import React from 'react';

const menuData = [
  { id: 1, name: 'فلات وايت', price: '18 SR', category: 'Hot' },
  { id: 2, name: 'سبانش لاتيه', price: '22 SR', category: 'Cold' },
  { id: 3, name: 'كيكة العسل', price: '25 SR', category: 'Sweets' },
];

export default function NmatMenu() {
  return (
    <div className="min-h-screen bg-nmat-beige text-nmat-black font-nmat-font">
      {/* Header مع اللوجو */}
      <header className="py-10 text-center">
        <img src="/nmat_logo.png" alt="Nmat Logo" className="mx-auto w-32 mb-4" />
        <h1 className="text-xl tracking-widest uppercase">Menu القائمة</h1>
      </header>

      {/* أقسام المنيو */}
      <main className="max-w-md mx-auto px-6 pb-20">
        <section className="mb-8">
          <h2 className="text-2xl border-b border-nmat-black pb-2 mb-6">القهوة / Coffee</h2>
          
          <div className="space-y-6">
            {menuData.map((item) => (
              <div key={item.id} className="flex justify-between items-center group cursor-pointer">
                <div>
                  <h3 className="text-lg font-bold group-hover:underline">{item.name}</h3>
                  <span className="text-sm opacity-60">وصف مختصر للمنتج هنا...</span>
                </div>
                <div className="text-lg font-medium">{item.price}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Footer بسيط */}
        <footer className="mt-20 text-center opacity-50 text-sm italic">
          <p>صُنع بكل حب في nmat cafe</p>
        </footer>
      </main>
    </div>
  );
}

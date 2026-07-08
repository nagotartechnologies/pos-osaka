"use client"

import { usePOS } from "@/hooks/use-pos"
import { ProductGrid } from "./components/product-grid"
import { CartSidebar } from "./components/cart-sidebar"
import { CustomizeModal } from "./components/customize-modal"
import { BuildCustomModal } from "./components/build-custom-modal"
import { toast } from "@/hooks/use-toast"

export default function POSPage() {
  const pos = usePOS()

  const handleSubmit = async () => {
    const ok = await pos.handleSubmit()
    if (ok) {
      toast({ title: "Pedido creado exitosamente" })
    }
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] lg:h-screen overflow-hidden">
      {/* Left: Products */}
      <div className="flex-1 min-w-0 overflow-hidden">
        <ProductGrid
          products={pos.products}
          filtered={pos.filtered}
          topSellers={pos.topSellers}
          categories={pos.categories}
          search={pos.search}
          setSearch={pos.setSearch}
          selectedCat={pos.selectedCat}
          setSelectedCat={pos.setSelectedCat}
          getCartQty={pos.getCartQty}
          onAdd={pos.addToCart}
          onBuildCustom={pos.openBuildCustom}
          loading={pos.loading}
        />
      </div>

      {/* Right: Cart sidebar — hidden on mobile when empty, always visible on lg+ */}
      <div className={`w-full lg:w-[340px] xl:w-[380px] flex-shrink-0 ${
        pos.cartCount > 0 ? "fixed inset-0 z-40 lg:relative lg:inset-auto lg:z-auto" : "hidden lg:flex"
      }`}>
        {/* Mobile backdrop */}
        {pos.cartCount > 0 && (
          <div className="absolute inset-0 bg-black/40 lg:hidden" onClick={() => {}} />
        )}
        <div className={`${
          pos.cartCount > 0 ? "absolute right-0 top-0 bottom-0 w-[85%] sm:w-[340px] lg:relative lg:w-full" : "w-full"
        }`}>
          <CartSidebar
            cart={pos.cart}
            updateQty={pos.updateQty}
            removeFromCart={pos.removeFromCart}
            getItemUnitPrice={pos.getItemUnitPrice}
            getCartQty={pos.getCartQty}
            cartTotal={pos.cartTotal}
            orderTotal={pos.orderTotal}
            cartCount={pos.cartCount}
            addSalsa={pos.addSalsa}
            getSalsaLimitReached={pos.getSalsaLimitReached}
            clientName={pos.clientName}
            setClientName={pos.setClientName}
            clientPhone={pos.clientPhone}
            setClientPhone={pos.setClientPhone}
            deliveryType={pos.deliveryType}
            setDeliveryType={pos.setDeliveryType}
            address={pos.address}
            setAddress={pos.setAddress}
            paymentMethod={pos.paymentMethod}
            setPaymentMethod={pos.setPaymentMethod}
            cardType={pos.cardType}
            setCardType={pos.setCardType}
            cashAmount={pos.cashAmount}
            setCashAmount={pos.setCashAmount}
            deliveryFee={pos.deliveryFee}
            submitting={pos.submitting}
            onSubmit={handleSubmit}
          />
        </div>
      </div>

      {/* Floating cart button for mobile */}
      {pos.cartCount > 0 && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-30 lg:hidden">
          <button className="flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-lg">
            🛒 {pos.cartCount} · ${pos.orderTotal.toLocaleString("es-CL")}
          </button>
        </div>
      )}

      {/* Modals */}
      {pos.customizeProduct && (
        <CustomizeModal
          product={pos.customizeProduct}
          protein={pos.customProtein}
          setProtein={pos.setCustomProtein}
          wrapper={pos.customWrapper}
          setWrapper={pos.setCustomWrapper}
          instructions={pos.customInstructions}
          setInstructions={pos.setCustomInstructions}
          triedConfirm={pos.customTriedConfirm}
          hasCustomChange={pos.hasCustomChange}
          onConfirm={pos.confirmCustomization}
          onClose={() => pos.setCustomizeProduct(null)}
          isPerUnit={pos.isPerUnit}
          perUnitComplete={pos.perUnitComplete}
          unitChoices={pos.unitChoices}
          setUnitChoices={pos.setUnitChoices}
        />
      )}

      {pos.buildProduct && (
        <BuildCustomModal
          product={pos.buildProduct}
          notes={pos.buildNotes}
          setNotes={pos.setBuildNotes}
          triedConfirm={pos.buildTriedConfirm}
          onConfirm={pos.confirmBuildCustom}
          onClose={() => pos.setBuildProduct(null)}
        />
      )}
    </div>
  )
}

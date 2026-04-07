"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/context";

interface OrderItem {
  id: string;
  productName: string;
  quantity: number;
  unitPrice: number | null;
  notes: string | null;
}

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: number | null;
  currency: string;
  notes: string | null;
  shippingName: string | null;
  shippingAddr: string | null;
  shippingCity: string | null;
  shippingCountry: string | null;
  shippingZip: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  carrier: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  items: OrderItem[];
}

const STEPS = ["pending", "confirmed", "processing", "shipped", "delivered"];

function StepIndicator({ status }: { status: string }) {
  const currentIdx = STEPS.indexOf(status);
  const isCancelled = status === "cancelled";

  if (isCancelled) {
    return (
      <div className="flex items-center gap-2 text-sm text-red-600 font-medium bg-red-50 px-4 py-2 rounded-lg">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
        Order Cancelled
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 w-full">
      {STEPS.map((step, i) => {
        const done = i <= currentIdx;
        const isCurrent = i === currentIdx;
        return (
          <div key={step} className="flex-1 flex flex-col items-center">
            <div className="flex items-center w-full">
              {i > 0 && (
                <div className={`flex-1 h-0.5 ${done ? "bg-accent" : "bg-gray-200"}`} />
              )}
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  done
                    ? isCurrent
                      ? "bg-accent text-white ring-2 ring-accent/30"
                      : "bg-accent text-white"
                    : "bg-gray-200 text-gray-400"
                }`}
              >
                {done && !isCurrent ? (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 ${i < currentIdx ? "bg-accent" : "bg-gray-200"}`} />
              )}
            </div>
            <span className={`text-[10px] mt-1.5 capitalize ${done ? "text-gray-700 font-medium" : "text-gray-400"}`}>
              {step}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function OrderDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const { dict } = useI18n();
  const t = dict.dashboard?.orders || {};

  useEffect(() => {
    fetch("/api/dashboard/orders")
      .then((r) => r.json())
      .then((data: Order[]) => {
        setOrder(data.find((o) => o.id === id) || null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <main className="px-4 sm:px-6 lg:px-8 py-8 max-w-4xl mx-auto">
        <div className="text-center py-12 text-gray-400">Loading...</div>
      </main>
    );
  }

  if (!order) {
    return (
      <main className="px-4 sm:px-6 lg:px-8 py-8 max-w-4xl mx-auto">
        <div className="text-center py-12">
          <p className="text-gray-500 mb-3">Order not found</p>
          <Link href="/dashboard/orders" className="text-accent hover:underline text-sm">
            Back to Orders
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-4xl mx-auto">
      {/* Back */}
      <Link
        href="/dashboard/orders"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        {t.backToOrders || "Back to Orders"}
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t.orderLabel || "Order"} #{order.orderNumber}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {t.placed || "Placed"} {new Date(order.createdAt).toLocaleDateString()}
          </p>
        </div>
        {order.totalAmount != null && (
          <div className="text-right">
            <p className="text-2xl font-bold text-gray-900">
              {order.currency} {order.totalAmount.toLocaleString()}
            </p>
          </div>
        )}
      </div>

      {/* Progress */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">{t.orderStatus || "Order Status"}</h2>
        <StepIndicator status={order.status} />
      </div>

      <div className="grid sm:grid-cols-2 gap-6 mb-6">
        {/* Shipping Info */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">{t.shippingInfo || "Shipping Information"}</h2>
          {order.trackingNumber ? (
            <div className="space-y-2">
              {order.carrier && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{t.carrier || "Carrier"}</span>
                  <span className="text-gray-900 font-medium">{order.carrier}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">{t.tracking || "Tracking"}</span>
                {order.trackingUrl ? (
                  <a href={order.trackingUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline font-medium">
                    {order.trackingNumber}
                  </a>
                ) : (
                  <span className="text-gray-900 font-medium">{order.trackingNumber}</span>
                )}
              </div>
              {order.shippedAt && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{t.shippedDate || "Shipped"}</span>
                  <span className="text-gray-900">{new Date(order.shippedAt).toLocaleDateString()}</span>
                </div>
              )}
              {order.deliveredAt && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{t.deliveredDate || "Delivered"}</span>
                  <span className="text-green-600 font-medium">{new Date(order.deliveredAt).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400">{t.noTracking || "Tracking info will appear once shipped."}</p>
          )}
        </div>

        {/* Shipping Address */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">{t.shippingAddress || "Shipping Address"}</h2>
          {order.shippingName ? (
            <div className="text-sm text-gray-700 space-y-0.5">
              <p className="font-medium">{order.shippingName}</p>
              {order.shippingAddr && <p>{order.shippingAddr}</p>}
              <p>
                {[order.shippingCity, order.shippingZip, order.shippingCountry]
                  .filter(Boolean)
                  .join(", ")}
              </p>
            </div>
          ) : (
            <p className="text-sm text-gray-400">{t.noAddress || "Shipping address not set."}</p>
          )}
        </div>
      </div>

      {/* Items */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">{t.items || "Items"}</h2>
        </div>
        <div className="divide-y divide-gray-50">
          {order.items.map((item) => (
            <div key={item.id} className="px-5 py-3.5 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">{item.productName}</p>
                {item.notes && <p className="text-xs text-gray-400 mt-0.5">{item.notes}</p>}
              </div>
              <div className="text-right shrink-0 ml-4">
                <p className="text-sm text-gray-500">×{item.quantity}</p>
                {item.unitPrice != null && (
                  <p className="text-xs text-gray-400">
                    {order.currency} {item.unitPrice.toLocaleString()} ea.
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Notes */}
      {order.notes && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mt-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-2">{t.notes || "Notes"}</h2>
          <p className="text-sm text-gray-600 whitespace-pre-wrap">{order.notes}</p>
        </div>
      )}
    </main>
  );
}

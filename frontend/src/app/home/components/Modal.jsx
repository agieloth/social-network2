"use client";

import React from "react";
import styles from "./Modal.module.css";

export default function Modal({ onClose, children }) {
  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        {/* Close Button */}
        <button onClick={onClose} className={styles.closeButton}>
          ✖
        </button>

        {/* Modal Content */}
        {children}
      </div>
    </div>
  );
}
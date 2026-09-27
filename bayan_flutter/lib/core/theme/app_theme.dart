import 'package:flutter/material.dart';

class AppTheme {
  // Global Enterprise ERP Palette (Odoo / SAP / Zoho Books Style)
  static const Color darkBackground = Color(0xFF0F172A); // Slate 900
  static const Color darkCard = Color(0xFF1E293B);       // Slate 800
  static const Color darkCardElevated = Color(0xFF334155); // Slate 700
  static const Color primaryBlue = Color(0xFF2563EB);    // Royal Executive Blue
  static const Color accentIndigo = Color(0xFF4F46E5);   // Indigo Accent
  static const Color textPrimary = Color(0xFFF8FAFC);    // High contrast white
  static const Color textSecondary = Color(0xFF94A3B8);  // Slate 400
  static const Color borderColor = Color(0xFF334155);    // Slate 700 Border
  static const Color successGreen = Color(0xFF10B981);   // Emerald 500
  static const Color warningAmber = Color(0xFFF59E0B);   // Amber 500
  static const Color dangerRed = Color(0xFFEF4444);      // Red 500

  static ThemeData get darkTheme {
    return ThemeData(
      brightness: Brightness.dark,
      scaffoldBackgroundColor: darkBackground,
      primaryColor: primaryBlue,
      colorScheme: const ColorScheme.dark(
        primary: primaryBlue,
        secondary: accentIndigo,
        background: darkBackground,
        surface: darkCard,
      ),
      cardTheme: CardTheme(
        color: darkCard,
        elevation: 2,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: const BorderSide(color: borderColor, width: 1),
        ),
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: darkCard,
        elevation: 0,
        centerTitle: false,
        iconTheme: IconThemeData(color: textPrimary),
        titleTextStyle: TextStyle(
          color: textPrimary,
          fontSize: 18,
          fontWeight: FontWeight.bold,
        ),
      ),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: darkCard,
        selectedItemColor: primaryBlue,
        unselectedItemColor: textSecondary,
        type: BottomNavigationBarType.fixed,
        elevation: 8,
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: darkCardElevated,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: borderColor),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: borderColor),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: primaryBlue, width: 2),
        ),
        labelStyle: const TextStyle(color: textSecondary),
        hintStyle: const TextStyle(color: textSecondary),
      ),
    );
  }
}

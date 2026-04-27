/**
 * @file MarkdownPreviewView.test.tsx
 * @description Tests for Markdown preview component, including XSS prevention
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import DOMPurify from 'dompurify';
import MarkdownPreviewView from '@/components/MarkdownPreviewView';
import { installElectronAPI, uninstallElectronAPI, createMockElectronAPI } from './mocks/electronAPI';

describe('MarkdownPreviewView', () => {
  beforeEach(() => {
    installElectronAPI();
  });

  afterEach(() => {
    uninstallElectronAPI();
    vi.clearAllMocks();
  });

  describe('XSS Prevention', () => {
    it('should sanitize script tags in markdown', async () => {
      const mockAPI = createMockElectronAPI();
      mockAPI.readFile = vi.fn().mockResolvedValue('# Test\n<script>alert("XSS")</script>');
      mockAPI.path.join = vi.fn().mockResolvedValue('/test/path.md');
      window.electronAPI = mockAPI;

      const { container } = render(
        <MarkdownPreviewView
          filePath="test.md"
          projectRootPath="/test"
          editorTheme="light"
        />
      );

      await waitFor(() => {
        const previewDiv = container.querySelector('.markdown-body');
        expect(previewDiv).toBeTruthy();
        // Script tag should be removed by DOMPurify
        expect(previewDiv?.innerHTML).not.toContain('<script>');
        expect(previewDiv?.innerHTML).not.toContain('alert');
      });
    });

    it('should sanitize event handlers in markdown', async () => {
      const mockAPI = createMockElectronAPI();
      mockAPI.readFile = vi.fn().mockResolvedValue('<img src="x" onerror="alert(\'XSS\')">');
      mockAPI.path.join = vi.fn().mockResolvedValue('/test/path.md');
      window.electronAPI = mockAPI;

      const { container } = render(
        <MarkdownPreviewView
          filePath="test.md"
          projectRootPath="/test"
          editorTheme="light"
        />
      );

      await waitFor(() => {
        const previewDiv = container.querySelector('.markdown-body');
        expect(previewDiv).toBeTruthy();
        // onerror attribute should be removed by DOMPurify
        expect(previewDiv?.innerHTML).not.toContain('onerror');
      });
    });

    it('should sanitize javascript: URLs in links', async () => {
      const mockAPI = createMockElectronAPI();
      mockAPI.readFile = vi.fn().mockResolvedValue('[Click me](javascript:alert("XSS"))');
      mockAPI.path.join = vi.fn().mockResolvedValue('/test/path.md');
      window.electronAPI = mockAPI;

      const { container } = render(
        <MarkdownPreviewView
          filePath="test.md"
          projectRootPath="/test"
          editorTheme="light"
        />
      );

      await waitFor(() => {
        const previewDiv = container.querySelector('.markdown-body');
        expect(previewDiv).toBeTruthy();
        // javascript: protocol should be removed by DOMPurify
        expect(previewDiv?.innerHTML).not.toContain('javascript:');
      });
    });

    it('should preserve legitimate markdown content', async () => {
      const legitimateContent = `# Heading
**Bold text**
*Italic text*
[Normal link](https://example.com)
\`code snippet\``;

      const mockAPI = createMockElectronAPI();
      mockAPI.readFile = vi.fn().mockResolvedValue(legitimateContent);
      mockAPI.path.join = vi.fn().mockResolvedValue('/test/path.md');
      window.electronAPI = mockAPI;

      const { container } = render(
        <MarkdownPreviewView
          filePath="test.md"
          projectRootPath="/test"
          editorTheme="light"
        />
      );

      await waitFor(() => {
        const previewDiv = container.querySelector('.markdown-body');
        expect(previewDiv).toBeTruthy();
        // Legitimate HTML should be preserved
        expect(previewDiv?.innerHTML).toContain('<strong>');
        expect(previewDiv?.innerHTML).toContain('<em>');
        expect(previewDiv?.innerHTML).toContain('<a href="https://example.com"');
        expect(previewDiv?.innerHTML).toContain('<code>');
      });
    });

    it('should preserve legitimate images', async () => {
      const mockAPI = createMockElectronAPI();
      mockAPI.readFile = vi.fn().mockResolvedValue('![Alt text](https://via.placeholder.com/150)');
      mockAPI.path.join = vi.fn().mockResolvedValue('/test/path.md');
      window.electronAPI = mockAPI;

      const { container } = render(
        <MarkdownPreviewView
          filePath="test.md"
          projectRootPath="/test"
          editorTheme="light"
        />
      );

      await waitFor(() => {
        const previewDiv = container.querySelector('.markdown-body');
        expect(previewDiv).toBeTruthy();
        // Legitimate images should be preserved
        expect(previewDiv?.innerHTML).toContain('<img');
        expect(previewDiv?.innerHTML).toContain('src="https://via.placeholder.com/150"');
        expect(previewDiv?.innerHTML).toContain('alt="Alt text"');
      });
    });
  });

  describe('DOMPurify integration', () => {
    it('should use DOMPurify to sanitize HTML', () => {
      const maliciousHtml = '<script>alert("XSS")</script><p>Safe content</p>';
      const sanitized = DOMPurify.sanitize(maliciousHtml);

      expect(sanitized).not.toContain('<script>');
      expect(sanitized).toContain('<p>Safe content</p>');
    });

    it('should allow whitelisted tags and attributes', () => {
      const html = '<p class="test"><a href="https://example.com">Link</a></p>';
      const sanitized = DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ['p', 'a'],
        ALLOWED_ATTR: ['href', 'class']
      });

      expect(sanitized).toContain('<p class="test">');
      expect(sanitized).toContain('<a href="https://example.com">');
    });

    it('should remove disallowed attributes', () => {
      const html = '<img src="image.jpg" onclick="alert(\'XSS\')" onerror="alert(\'XSS\')">';
      const sanitized = DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ['img'],
        ALLOWED_ATTR: ['src', 'alt']
      });

      expect(sanitized).not.toContain('onclick');
      expect(sanitized).not.toContain('onerror');
      expect(sanitized).toContain('src="image.jpg"');
    });
  });
});

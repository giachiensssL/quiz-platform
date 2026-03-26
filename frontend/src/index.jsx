import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

class RootErrorBoundary extends React.Component {
	constructor(props) {
		super(props);
		this.state = { hasError: false, message: '' };
	}

	static getDerivedStateFromError(error) {
		return {
			hasError: true,
			message: error?.message || 'Ứng dụng gặp lỗi không xác định.',
		};
	}

	componentDidCatch(error) {
		// Keep log for debugging in browser console.
		// eslint-disable-next-line no-console
		console.error('Root crash:', error);
	}

	render() {
		if (this.state.hasError) {
			return (
				<div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, fontFamily: 'Outfit, sans-serif', background: '#f4f6fa' }}>
					<div style={{ maxWidth: 680, width: '100%', background: '#fff', border: '1px solid #dde3ec', borderRadius: 12, padding: 20 }}>
						<h2 style={{ marginBottom: 8 }}>Không thể tải ứng dụng</h2>
						<p style={{ marginBottom: 12, color: '#4b6080' }}>Đã xảy ra lỗi runtime. Vui lòng tải lại trang. Nếu vẫn lỗi, gửi nội dung lỗi bên dưới cho admin.</p>
						<pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: '#f8fafc', border: '1px solid #e2e8f0', padding: 12, borderRadius: 8 }}>{this.state.message}</pre>
						<button type="button" onClick={() => window.location.reload()} style={{ marginTop: 12, background: '#0f2044', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 14px', cursor: 'pointer' }}>
							Tải lại trang
						</button>
					</div>
				</div>
			);
		}

		return this.props.children;
	}
}

window.addEventListener('error', (event) => {
	// eslint-disable-next-line no-console
	console.error('Uncaught error:', event?.error || event?.message || event);
});

window.addEventListener('unhandledrejection', (event) => {
	// eslint-disable-next-line no-console
	console.error('Unhandled promise rejection:', event?.reason || event);
});

ReactDOM.createRoot(document.getElementById('root')).render(
	<React.StrictMode>
		<RootErrorBoundary>
			<App />
		</RootErrorBoundary>
	</React.StrictMode>
);

// Small fetch helpers for GET and POST with JSON handling and timeout.
// Usage:
// import { getJSON, postJSON } from './lib/api/api'
// const data = await getJSON('/api/items')
// const created = await postJSON('/api/items', { name: 'new' })

const DEFAULT_TIMEOUT = 10000 // ms
const BASE_URL = "http://localhost:8080"

function buildHeaders(customHeaders) {
	return Object.assign({
		'Accept': 'application/json',
		'Content-Type': 'application/json'
	}, customHeaders || {})
}

async function parseResponse(res) {
	const contentType = res.headers.get('content-type') || ''
	const isJSON = contentType.includes('application/json')
	const text = await res.text()

	if (!res.ok) {
		// try to include parsed body for better errors
		let body = text
		if (isJSON && text) {
			try { body = JSON.parse(text) } catch (e) { /* ignore */ }
		}
		const err = new Error(res.statusText || 'HTTP error')
		err.status = res.status
		err.body = body
		throw err
	}

	if (!text) return null
	return isJSON ? JSON.parse(text) : text
}

function timeoutSignal(timeout) {
	const controller = new AbortController()
	const id = setTimeout(() => controller.abort(), timeout)
	return { signal: controller.signal, clear: () => clearTimeout(id) }
}

export async function getJSON(url, { headers, timeout } = {}) {
	const to = timeout || DEFAULT_TIMEOUT
	const t = timeoutSignal(to)
	try {
		const res = await fetch(`${BASE_URL}${url}`, {
			method: 'GET',
			headers: buildHeaders(headers),
			signal: t.signal,
			credentials: "include"
		})
        
		return  {
            status: res.status,
            data: await parseResponse(res)
        }
	} catch (err) {
		// normalize abort error message
		if (err.name === 'AbortError') {
			const e = new Error('Request timed out')
			e.cause = err
			throw e
		}
		throw err
	} finally {
		t.clear()
	}
}

export async function postJSON(url, body, { headers, timeout } = {}) {
	const to = timeout || DEFAULT_TIMEOUT
	const t = timeoutSignal(to)
	try {
		const res = await fetch(`${BASE_URL}${url}`, {
			method: 'POST',
			headers: buildHeaders(headers),
			body: body == null ? null : JSON.stringify(body),
			signal: t.signal,
			credentials: "include"
		})
		
		// Handle error responses gracefully
		if (!res.ok) {
			const contentType = res.headers.get('content-type') || ''
			const isJSON = contentType.includes('application/json')
			const text = await res.text()
			let errorData = text
			if (isJSON && text) {
				try { errorData = JSON.parse(text) } catch (e) { /* ignore */ }
			}
			return {
				status: res.status,
				data: errorData
			}
		}
		
		return {
            status: res.status,
            data: await parseResponse(res)
        }
	} catch (err) {
		if (err.name === 'AbortError') {
			const e = new Error('Request timed out')
			e.cause = err
			throw e
		}
		throw err
	} finally {
		t.clear()
	}
}

export default {
	getJSON,
	postJSON
}


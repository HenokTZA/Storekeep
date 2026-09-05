import argparse
import requests


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default="http://127.0.0.1:8000")
    parser.add_argument("--username", default="owner")
    parser.add_argument("--password", default="ChangeMe123!")
    args = parser.parse_args()
    base = args.url.rstrip("/")
    token_response = requests.post(
        f"{base}/api/v1/auth/token/",
        json={"username": args.username, "password": args.password},
        timeout=15,
    )
    token_response.raise_for_status()
    headers = {"Authorization": f"Bearer {token_response.json()['access']}"}
    endpoints = [
        "/health/",
        "/api/v1/auth/me/",
        "/api/v1/dashboard/",
        "/api/v1/dashboard/details/?kind=today_sales",
        "/api/v1/dashboard/details/?kind=collected",
        "/api/v1/dashboard/details/?kind=owes_me",
        "/api/v1/dashboard/details/?kind=i_owe",
        "/api/v1/dashboard/details/?kind=today_expenses",
        "/api/v1/dashboard/details/?kind=month_expenses",
        "/api/v1/dashboard/details/?kind=today_transactions",
        "/api/v1/products/?page_size=3&common=1",
        "/api/v1/parties/",
    ]
    for endpoint in endpoints:
        response = requests.get(f"{base}{endpoint}", headers=headers, timeout=15)
        response.raise_for_status()
        print(f"PASS {endpoint} ({response.status_code})")

    products_response = requests.get(
        f"{base}/api/v1/products/?page_size=3&common=1",
        headers=headers,
        timeout=15,
    )
    products_response.raise_for_status()
    products = products_response.json()["results"]
    if len(products) > 3 or any(int(product.get("pieces_per_unit", 0)) < 1 for product in products):
        raise RuntimeError("Distributor product paging or pack metadata is invalid.")
    print("PASS distributor product paging and pack metadata")

    sales_response = requests.get(f"{base}/api/v1/sales/?page_size=1", headers=headers, timeout=15)
    sales_response.raise_for_status()
    sales = sales_response.json()["results"]
    if sales:
        invoice_response = requests.get(
            f"{base}/api/v1/sales/{sales[0]['id']}/invoice/",
            headers=headers,
            timeout=15,
        )
        invoice_response.raise_for_status()
        if invoice_response.headers.get("Content-Type") != "application/pdf" or not invoice_response.content.startswith(b"%PDF"):
            raise RuntimeError("Sale invoice endpoint did not return a PDF.")
        print("PASS authenticated sale invoice PDF")


if __name__ == "__main__":
    main()

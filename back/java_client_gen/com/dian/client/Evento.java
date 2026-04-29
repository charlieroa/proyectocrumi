
package com.dian.client;

import javax.xml.bind.JAXBElement;
import javax.xml.bind.annotation.XmlAccessType;
import javax.xml.bind.annotation.XmlAccessorType;
import javax.xml.bind.annotation.XmlElementRef;
import javax.xml.bind.annotation.XmlType;


/**
 * <p>Java class for Evento complex type.
 * 
 * <p>The following schema fragment specifies the expected content contained within this class.
 * 
 * <pre>
 * &lt;complexType name="Evento">
 *   &lt;complexContent>
 *     &lt;restriction base="{http://www.w3.org/2001/XMLSchema}anyType">
 *       &lt;sequence>
 *         &lt;element name="Codigo" type="{http://www.w3.org/2001/XMLSchema}string" minOccurs="0"/>
 *         &lt;element name="Descripcion" type="{http://www.w3.org/2001/XMLSchema}string" minOccurs="0"/>
 *         &lt;element name="Emisor" type="{http://schemas.datacontract.org/2004/07/Entidad}Entidad" minOccurs="0"/>
 *         &lt;element name="NumeroDocumento" type="{http://schemas.datacontract.org/2004/07/NumeroDocumento}NumeroDocumento" minOccurs="0"/>
 *         &lt;element name="Receptor" type="{http://schemas.datacontract.org/2004/07/Entidad}Entidad" minOccurs="0"/>
 *         &lt;element name="ReferenciasDocumento" type="{http://schemas.datacontract.org/2004/07/ReferenciaDocumento}ArrayOfReferenciaDocumento" minOccurs="0"/>
 *         &lt;element name="UUID" type="{http://www.w3.org/2001/XMLSchema}string" minOccurs="0"/>
 *         &lt;element name="ValidacionesDoc" type="{http://schemas.datacontract.org/2004/07/ValidacionDoc}ArrayOfValidacionDoc" minOccurs="0"/>
 *       &lt;/sequence>
 *     &lt;/restriction>
 *   &lt;/complexContent>
 * &lt;/complexType>
 * </pre>
 * 
 * 
 */
@XmlAccessorType(XmlAccessType.FIELD)
@XmlType(name = "Evento", namespace = "http://schemas.datacontract.org/2004/07/Evento", propOrder = {
    "codigo",
    "descripcion",
    "emisor",
    "numeroDocumento",
    "receptor",
    "referenciasDocumento",
    "uuid",
    "validacionesDoc"
})
public class Evento {

    @XmlElementRef(name = "Codigo", namespace = "http://schemas.datacontract.org/2004/07/Evento", type = JAXBElement.class, required = false)
    protected JAXBElement<String> codigo;
    @XmlElementRef(name = "Descripcion", namespace = "http://schemas.datacontract.org/2004/07/Evento", type = JAXBElement.class, required = false)
    protected JAXBElement<String> descripcion;
    @XmlElementRef(name = "Emisor", namespace = "http://schemas.datacontract.org/2004/07/Evento", type = JAXBElement.class, required = false)
    protected JAXBElement<Entidad> emisor;
    @XmlElementRef(name = "NumeroDocumento", namespace = "http://schemas.datacontract.org/2004/07/Evento", type = JAXBElement.class, required = false)
    protected JAXBElement<NumeroDocumento> numeroDocumento;
    @XmlElementRef(name = "Receptor", namespace = "http://schemas.datacontract.org/2004/07/Evento", type = JAXBElement.class, required = false)
    protected JAXBElement<Entidad> receptor;
    @XmlElementRef(name = "ReferenciasDocumento", namespace = "http://schemas.datacontract.org/2004/07/Evento", type = JAXBElement.class, required = false)
    protected JAXBElement<ArrayOfReferenciaDocumento> referenciasDocumento;
    @XmlElementRef(name = "UUID", namespace = "http://schemas.datacontract.org/2004/07/Evento", type = JAXBElement.class, required = false)
    protected JAXBElement<String> uuid;
    @XmlElementRef(name = "ValidacionesDoc", namespace = "http://schemas.datacontract.org/2004/07/Evento", type = JAXBElement.class, required = false)
    protected JAXBElement<ArrayOfValidacionDoc> validacionesDoc;

    /**
     * Gets the value of the codigo property.
     * 
     * @return
     *     possible object is
     *     {@link JAXBElement }{@code <}{@link String }{@code >}
     *     
     */
    public JAXBElement<String> getCodigo() {
        return codigo;
    }

    /**
     * Sets the value of the codigo property.
     * 
     * @param value
     *     allowed object is
     *     {@link JAXBElement }{@code <}{@link String }{@code >}
     *     
     */
    public void setCodigo(JAXBElement<String> value) {
        this.codigo = value;
    }

    /**
     * Gets the value of the descripcion property.
     * 
     * @return
     *     possible object is
     *     {@link JAXBElement }{@code <}{@link String }{@code >}
     *     
     */
    public JAXBElement<String> getDescripcion() {
        return descripcion;
    }

    /**
     * Sets the value of the descripcion property.
     * 
     * @param value
     *     allowed object is
     *     {@link JAXBElement }{@code <}{@link String }{@code >}
     *     
     */
    public void setDescripcion(JAXBElement<String> value) {
        this.descripcion = value;
    }

    /**
     * Gets the value of the emisor property.
     * 
     * @return
     *     possible object is
     *     {@link JAXBElement }{@code <}{@link Entidad }{@code >}
     *     
     */
    public JAXBElement<Entidad> getEmisor() {
        return emisor;
    }

    /**
     * Sets the value of the emisor property.
     * 
     * @param value
     *     allowed object is
     *     {@link JAXBElement }{@code <}{@link Entidad }{@code >}
     *     
     */
    public void setEmisor(JAXBElement<Entidad> value) {
        this.emisor = value;
    }

    /**
     * Gets the value of the numeroDocumento property.
     * 
     * @return
     *     possible object is
     *     {@link JAXBElement }{@code <}{@link NumeroDocumento }{@code >}
     *     
     */
    public JAXBElement<NumeroDocumento> getNumeroDocumento() {
        return numeroDocumento;
    }

    /**
     * Sets the value of the numeroDocumento property.
     * 
     * @param value
     *     allowed object is
     *     {@link JAXBElement }{@code <}{@link NumeroDocumento }{@code >}
     *     
     */
    public void setNumeroDocumento(JAXBElement<NumeroDocumento> value) {
        this.numeroDocumento = value;
    }

    /**
     * Gets the value of the receptor property.
     * 
     * @return
     *     possible object is
     *     {@link JAXBElement }{@code <}{@link Entidad }{@code >}
     *     
     */
    public JAXBElement<Entidad> getReceptor() {
        return receptor;
    }

    /**
     * Sets the value of the receptor property.
     * 
     * @param value
     *     allowed object is
     *     {@link JAXBElement }{@code <}{@link Entidad }{@code >}
     *     
     */
    public void setReceptor(JAXBElement<Entidad> value) {
        this.receptor = value;
    }

    /**
     * Gets the value of the referenciasDocumento property.
     * 
     * @return
     *     possible object is
     *     {@link JAXBElement }{@code <}{@link ArrayOfReferenciaDocumento }{@code >}
     *     
     */
    public JAXBElement<ArrayOfReferenciaDocumento> getReferenciasDocumento() {
        return referenciasDocumento;
    }

    /**
     * Sets the value of the referenciasDocumento property.
     * 
     * @param value
     *     allowed object is
     *     {@link JAXBElement }{@code <}{@link ArrayOfReferenciaDocumento }{@code >}
     *     
     */
    public void setReferenciasDocumento(JAXBElement<ArrayOfReferenciaDocumento> value) {
        this.referenciasDocumento = value;
    }

    /**
     * Gets the value of the uuid property.
     * 
     * @return
     *     possible object is
     *     {@link JAXBElement }{@code <}{@link String }{@code >}
     *     
     */
    public JAXBElement<String> getUUID() {
        return uuid;
    }

    /**
     * Sets the value of the uuid property.
     * 
     * @param value
     *     allowed object is
     *     {@link JAXBElement }{@code <}{@link String }{@code >}
     *     
     */
    public void setUUID(JAXBElement<String> value) {
        this.uuid = value;
    }

    /**
     * Gets the value of the validacionesDoc property.
     * 
     * @return
     *     possible object is
     *     {@link JAXBElement }{@code <}{@link ArrayOfValidacionDoc }{@code >}
     *     
     */
    public JAXBElement<ArrayOfValidacionDoc> getValidacionesDoc() {
        return validacionesDoc;
    }

    /**
     * Sets the value of the validacionesDoc property.
     * 
     * @param value
     *     allowed object is
     *     {@link JAXBElement }{@code <}{@link ArrayOfValidacionDoc }{@code >}
     *     
     */
    public void setValidacionesDoc(JAXBElement<ArrayOfValidacionDoc> value) {
        this.validacionesDoc = value;
    }

}
